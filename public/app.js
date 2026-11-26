// Frontend logic for Aura RAG
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
        container.innerHTML = `<div class="text-center py-4 text-zinc-600 font-mono text-xs">No indexed documents found.</div>`;
        return;
    }

    container.innerHTML = documents.map(d => `
        <div class="p-3 bg-zinc-950/80 rounded border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
            <div class="space-y-0.5 truncate pr-2">
                <div class="font-medium text-white truncate font-sans">${d.title}</div>
                <div class="text-[10px] text-zinc-500">${d.filename} &bull; ${(d.file_size / 1024).toFixed(1)} KB</div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
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
            document.getElementById('chunkCountBadge').innerText = `${data.chunks.length} Chunks`;
            container.innerHTML = data.chunks.map(c => `
                <div class="p-2 bg-zinc-950 rounded border border-zinc-800/80 text-[11px] space-y-1">
                    <div class="flex items-center justify-between text-zinc-500 font-mono text-[10px]">
                        <span class="text-zinc-400">${c.id} (Page ${c.page_number})</span>
                        <span>${c.token_count || 60} tokens</span>
                    </div>
                    <p class="text-zinc-300 font-sans line-clamp-2 leading-relaxed">${c.content}</p>
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
    badge.innerText = "QUERYING";
    badge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-700 text-white animate-pulse";

    container.innerHTML = `
        <div class="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-2 font-mono text-xs text-zinc-400">
            <div class="flex items-center space-x-2">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Calculating query embedding vector via @cf/baai/bge-small-en-v1.5...</span>
            </div>
            <div class="text-zinc-500 text-[11px]">&rarr; Ranking top-3 chunks using cosine distance (&lt;=&gt;)</div>
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
            badge.innerText = `MATCHED (${(data.citations[0]?.similarityScore * 100).toFixed(1)}%)`;
            badge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

            container.innerHTML = `
                <!-- Question -->
                <div class="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800/80 text-xs font-mono">
                    <div class="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Inquiry</div>
                    <div class="text-white font-sans text-xs font-medium">${data.question}</div>
                </div>

                <!-- Answer -->
                <div class="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-2">
                    <div class="flex items-center justify-between font-mono text-[10px] text-zinc-500 border-b border-zinc-900 pb-2">
                        <span class="text-emerald-400 font-semibold flex items-center">
                            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-2"></span>
                            Grounded Synthesis (Llama 3.2 3B)
                        </span>
                        <span>Latency: ${data.latencyMs}ms</span>
                    </div>
                    <p class="text-zinc-200 leading-relaxed font-sans text-xs sm:text-sm">${data.answer}</p>
                </div>

                <!-- Citations -->
                <div class="space-y-2 pt-2">
                    <div class="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                        <span>Retrieved Context Citations</span>
                        <span>Top-${data.citations.length} Ranked</span>
                    </div>
                    ${data.citations.map(c => `
                        <div class="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800/80 text-xs space-y-1 font-mono">
                            <div class="flex items-center justify-between text-[10px]">
                                <span class="text-zinc-300 font-medium">${c.documentTitle || c.documentId} &bull; Page ${c.pageNumber}</span>
                                <span class="px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-800 font-semibold">
                                    ${(c.similarityScore * 100).toFixed(1)}% Sim
                                </span>
                            </div>
                            <p class="text-zinc-400 text-[11px] font-sans leading-relaxed pt-1 border-t border-zinc-900/60">&ldquo;${c.content}&rdquo;</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            badge.innerText = "ERROR";
            badge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20";
            container.innerHTML = `<div class="p-4 bg-zinc-950 border border-red-500/30 text-red-400 text-xs rounded font-mono">${data.answer || data.error}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 bg-zinc-950 border border-red-500/30 text-red-400 text-xs rounded font-mono">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
    }
});

const uploadModal = document.getElementById('uploadModal');
document.getElementById('openUploadModalBtn').addEventListener('click', () => uploadModal.classList.remove('hidden'));
document.getElementById('closeUploadModalBtn').addEventListener('click', () => uploadModal.classList.add('hidden'));
document.getElementById('cancelUploadModalBtn').addEventListener('click', () => uploadModal.classList.add('hidden'));

document.getElementById('uploadDocForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('docTitleInput').value.trim();
    const content = document.getElementById('docContentInput').value.trim();
    if (!title || !content) return;

    try {
        await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        uploadModal.classList.add('hidden');
        document.getElementById('uploadDocForm').reset();
        await fetchDocuments();
        await fetchChunks();
        alert("Document ingested, chunked, and embedded into vector store.");
    } catch (err) {
        alert("Upload error: " + err.message);
    }
});

fetchDocuments();
fetchChunks();
