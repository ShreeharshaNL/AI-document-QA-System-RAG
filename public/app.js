// Frontend logic for AI Document Q&A (RAG)
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
        container.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">No documents indexed yet.</div>`;
        return;
    }

    container.innerHTML = documents.map(d => `
        <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
            <div class="space-y-0.5 truncate pr-2">
                <div class="font-bold text-white truncate">${d.title}</div>
                <div class="text-[11px] text-slate-500 font-mono">${d.filename} &bull; ${(d.file_size / 1024).toFixed(1)} KB</div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
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
                <div class="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                    <div class="flex items-center justify-between text-slate-500 font-semibold">
                        <span class="text-teal-400 font-mono">${c.id} (Page ${c.page_number})</span>
                        <span class="text-[10px] text-slate-500">384-dim</span>
                    </div>
                    <p class="text-slate-300 font-sans line-clamp-2">${c.content}</p>
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
    badge.innerText = "Vector Search & Synthesizing...";
    badge.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 animate-pulse";

    container.innerHTML = `
        <div class="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
            <div class="flex items-center space-x-2 text-xs text-slate-400">
                <span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Generating query embeddings and querying pgvector similarity index...</span>
            </div>
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
            badge.innerText = `Matched (${(data.citations[0]?.similarityScore * 100).toFixed(1)}% Sim)`;
            badge.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400";

            container.innerHTML = `
                <!-- Question -->
                <div class="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs">
                    <div class="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">User Question</div>
                    <div class="text-white font-medium">${data.question}</div>
                </div>

                <!-- Grounded Answer -->
                <div class="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 text-xs space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-emerald-400 text-xs flex items-center">
                            <i class="fa-solid fa-sparkles mr-1.5 text-emerald-400"></i>
                            Grounded Answer (Llama 3.1)
                        </span>
                        <span class="text-[10px] text-slate-500 font-mono">Source-Cited</span>
                    </div>
                    <p class="text-slate-200 leading-relaxed text-sm">${data.answer}</p>
                </div>

                <!-- Citations List -->
                <div class="space-y-2 pt-2">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Retrieved Context Excerpts (pgvector)</span>
                        <span class="font-mono text-[10px] text-slate-500">Top-${data.citations.length} Ranked</span>
                    </div>
                    ${data.citations.map(c => `
                        <div class="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs space-y-1">
                            <div class="flex items-center justify-between font-mono text-[11px]">
                                <span class="text-teal-400 font-semibold">Chunk ${c.chunkIndex} (Page ${c.pageNumber})</span>
                                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                                    ${(c.similarityScore * 100).toFixed(1)}% Match
                                </span>
                            </div>
                            <p class="text-slate-300 text-[11px] italic">&ldquo;${c.content}&rdquo;</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            badge.innerText = "Error";
            badge.className = "text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400";
            container.innerHTML = `<div class="p-4 bg-red-950/30 border border-red-500/30 text-red-400 text-xs rounded-xl">${data.answer || data.error}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 bg-red-950/30 border border-red-500/30 text-red-400 text-xs rounded-xl">Error: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
    }
});

// Modal handling
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
        alert("Document successfully ingested and embedded!");
    } catch (err) {
        alert("Upload error: " + err.message);
    }
});

// Initial Load
fetchDocuments();
fetchChunks();
