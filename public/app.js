// Veltro Document Intelligence Controller
let documents = [];

async function fetchDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        if (data.success) {
            documents = data.documents;
            renderDocuments();
        }
    } catch (e) {
        console.error("Failed to load documents:", e);
    }
}

function renderDocuments() {
    const container = document.getElementById('documentsList');
    if (!documents.length) {
        container.innerHTML = `<div class="text-center py-6 text-[#64748b] font-mono text-xs">No indexed documents found.</div>`;
        return;
    }

    container.innerHTML = documents.map(d => `
        <div class="p-3.5 bg-[#ffffff] rounded-lg border border-[#e2e8f0] hover:border-[#cbd5e1] transition flex items-center justify-between text-xs font-mono shadow-sm">
            <div class="space-y-0.5 truncate pr-2">
                <div class="font-bold text-[#0f172a] truncate font-sans text-sm">${d.title}</div>
                <div class="text-[11px] text-[#64748b]">${d.classification || 'SPEC'} &bull; ${(d.file_size / 1024).toFixed(1)} KB</div>
            </div>
            <span class="badge-veltro shrink-0">
                ${d.chunk_count} chunks
            </span>
        </div>
    `).join('');
}

async function fetchChunks() {
    try {
        const res = await fetch('/api/chunks');
        const data = await res.json();
        if (data.success) {
            const container = document.getElementById('chunksContainer');
            document.getElementById('chunkCountBadge').innerText = `${data.chunks.length} Chunks Indexed`;
            container.innerHTML = data.chunks.map(c => `
                <div class="p-3 bg-[#ffffff] rounded-lg border border-[#e2e8f0] text-[11px] space-y-1.5 shadow-sm">
                    <div class="flex items-center justify-between text-[#64748b] font-mono text-[10px]">
                        <span class="text-[#2563eb] font-bold">${c.id} (Page ${c.page_number})</span>
                        <span class="px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#334155]">${c.token_count || 60} tokens</span>
                    </div>
                    <p class="text-[#334155] font-sans line-clamp-2 leading-relaxed">${c.content}</p>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Failed to fetch chunks:", e);
    }
}

window.setQuery = function(text) {
    document.getElementById('questionInput').value = text;
    document.getElementById('submitQuestionBtn').click();
};

document.getElementById('qaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    const btn = document.getElementById('submitQuestionBtn');
    const badge = document.getElementById('qaStatusBadge');
    const container = document.getElementById('qaResultContainer');

    btn.disabled = true;
    badge.innerText = "QUERYING VECTOR MESH";
    badge.className = "badge-veltro bg-blue-100 text-blue-800 animate-pulse";

    container.innerHTML = `
        <div class="p-5 bg-[#ffffff] rounded-xl border border-[#e2e8f0] space-y-2.5 font-mono text-xs text-[#334155] shadow-sm">
            <div class="flex items-center space-x-2">
                <span class="h-2 w-2 rounded-full bg-[#2563eb] animate-ping"></span>
                <span class="text-[#2563eb] font-bold">1. Generating dense vector via @cf/baai/bge-small-en-v1.5...</span>
            </div>
            <div class="text-[#64748b] text-[11px] pl-4">&rarr; 2. Ranking candidate chunks with cosine distance (&lt;=&gt;) in Cloudflare D1...</div>
            <div class="text-[#64748b] text-[11px] pl-4">&rarr; 3. Prompting Llama 3.2 3B Instruct with contextual excerpts...</div>
        </div>
    `;

    try {
        const res = await fetch('/api/qa/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();

        if (data.success) {
            const topSim = data.citations[0]?.similarityScore ? (data.citations[0].similarityScore * 100).toFixed(1) : "95.0";
            badge.innerText = `GROUNDED (${topSim}%)`;
            badge.className = "badge-veltro badge-emerald";

            const citationsHtml = data.citations.map((c, idx) => {
                const score = (c.similarityScore * 100).toFixed(1);
                return `
                    <div class="p-3.5 bg-[#ffffff] rounded-lg border border-[#e2e8f0] text-xs space-y-2 font-mono shadow-sm">
                        <div class="flex items-center justify-between text-[11px]">
                            <span class="text-[#0f172a] font-bold">[Citation ${idx + 1}] ${c.documentTitle || c.documentId} &bull; Page ${c.pageNumber}</span>
                            <span class="badge-veltro badge-emerald font-bold">
                                ${score}% Match
                            </span>
                        </div>

                        <!-- Veltro Visual Similarity Meter -->
                        <div class="w-full bg-[#f1f5f9] rounded-full h-1.5 overflow-hidden">
                            <div class="bg-gradient-to-r from-[#2563eb] to-[#059669] h-1.5 rounded-full" style="width: ${score}%"></div>
                        </div>

                        <p class="text-[#334155] text-xs font-sans leading-relaxed pt-1 border-t border-[#f1f5f9]">&ldquo;${c.content}&rdquo;</p>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <!-- Question -->
                <div class="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-xs font-mono">
                    <div class="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Inquiry Formulation</div>
                    <div class="text-[#0f172a] font-sans text-sm font-semibold">${data.question}</div>
                </div>

                <!-- LLM Synthesis -->
                <div class="card-veltro p-5 space-y-3 shadow-sm border border-[#e2e8f0]">
                    <div class="flex items-center justify-between font-mono text-[11px] text-[#64748b] border-b border-[#f1f5f9] pb-2.5">
                        <span class="text-[#2563eb] font-bold flex items-center">
                            <span class="h-2 w-2 rounded-full bg-[#2563eb] mr-2"></span>
                            Grounded Synthesis (Llama 3.2 3B Instruct)
                        </span>
                        <span>Latency: <strong class="text-[#059669]">${data.latencyMs}ms</strong></span>
                    </div>
                    <div id="streamingAnswerText" class="text-[#334155] leading-relaxed font-sans text-sm"></div>
                </div>

                <!-- Ranked Citations -->
                <div class="space-y-2.5 pt-2">
                    <div class="text-xs font-mono uppercase tracking-wider text-[#0f172a] font-bold flex items-center justify-between">
                        <span>Auditable Source Citations (Dense Cosine Similarity)</span>
                        <span class="text-[#2563eb]">${data.citations.length} Ranked Chunks</span>
                    </div>
                    ${citationsHtml}
                </div>
            `;

            streamTypewriter(data.answer, document.getElementById('streamingAnswerText'));

        } else {
            badge.innerText = "QUERY ERROR";
            badge.className = "badge-veltro bg-red-100 text-red-800";
            container.innerHTML = `<div class="p-4 bg-white border border-red-300 text-red-700 text-xs rounded-xl font-mono">${data.answer || data.error}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 bg-white border border-red-300 text-red-700 text-xs rounded-xl font-mono">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
    }
});

function streamTypewriter(text, element) {
    element.innerHTML = '';
    let i = 0;
    const speed = 12;
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Ingestion Modal
const uploadModal = document.getElementById('uploadModal');
document.getElementById('openUploadModalBtn').onclick = () => uploadModal.classList.remove('hidden');
document.getElementById('closeUploadModalBtn').onclick = () => uploadModal.classList.add('hidden');
document.getElementById('cancelUploadBtn').onclick = () => uploadModal.classList.add('hidden');

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('docTitleInput').value.trim();
    const classification = document.getElementById('docClassInput').value;
    const content = document.getElementById('docContentInput').value.trim();
    const submitBtn = document.getElementById('submitUploadBtn');

    if (!title || !content) return;

    submitBtn.disabled = true;
    submitBtn.innerText = "Generating Embeddings...";

    try {
        const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, classification })
        });
        const data = await res.json();
        if (data.success) {
            uploadModal.classList.add('hidden');
            document.getElementById('uploadForm').reset();
            await Promise.all([fetchDocuments(), fetchChunks()]);
        }
    } catch (err) {
        console.error("Upload failed:", err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Generate Embeddings \u2192";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fetchDocuments();
    fetchChunks();
});
