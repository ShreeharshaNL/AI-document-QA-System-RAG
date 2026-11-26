// Aura Document Intelligence Controller
let documents = [];

const domainData = {
    cyber: {
        title: "Cyber Law & IT Act 2000",
        desc: "Rigorous statutory issue detection over Section 66D (identity theft & online fraud impersonation) and Section 43 (unauthorized access to computer systems).",
        query: "How does LegalLens classify digital financial fraud under IT Act 2000 and BNS 2023?",
        corpusTag: "LegalLens Cyber Series"
    },
    criminal: {
        title: "Criminal Justice (BNS 2023)",
        desc: "Bharatiya Nyaya Sanhita 2023 Section 318(4) statutory analysis for dishonest inducement and economic offenses with penalty thresholds.",
        query: "What are the essential ingredients of cheating under BNS 2023 Section 318(4)?",
        corpusTag: "Penal Code Modernization"
    },
    labor: {
        title: "Labor & Wage Regulation",
        desc: "Statutory precedence rules under Code on Wages 2019 superseding Payment of Wages Act 1936 and Minimum Wages Act 1948.",
        query: "How does LegalLens handle statutory precedence between Code on Wages 2019 and legacy laws?",
        corpusTag: "Central Labor Enactments"
    },
    distributed: {
        title: "Distributed Systems Specs",
        desc: "Apache Kafka Outbox pattern, Saga compensation protocols, and PostgreSQL pgvector semantic retrieval architectures.",
        query: "What compensating transaction occurs in the Saga workflow when inventory depletion happens?",
        corpusTag: "Distributed Systems"
    }
};

window.switchDomain = function(domainKey) {
    const data = domainData[domainKey];
    if (!data) return;

    ['cyber', 'criminal', 'labor', 'distributed'].forEach(key => {
        const el = document.getElementById(`tab-${key}`);
        if (!el) return;

        if (key === domainKey) {
            el.className = "accordion-hero-card p-6 cursor-pointer relative overflow-hidden transition-all duration-300";
            el.innerHTML = `
                <div class="flex items-start justify-between">
                    <h3 class="text-xl font-bold text-white tracking-tight">${data.title}</h3>
                    <div class="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                </div>
                <p class="text-sm text-slate-300 mt-3 leading-relaxed font-normal">${data.desc}</p>
                <div class="mt-4 pt-3 border-t border-white/20 text-xs font-bold tracking-wider uppercase text-[#c4f82a] flex items-center space-x-1.5 font-mono">
                    <span>— STATUTORY CORPUS: ${data.corpusTag}</span>
                </div>
            `;
        } else {
            el.className = "card-optimum p-5 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition";
            el.innerHTML = `
                <span class="text-base font-bold text-[#0f172a]">${domainData[key].title}</span>
                <div class="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            `;
        }
    });

    document.getElementById('questionInput').value = data.query;
};

// Fetch Dynamic Documents from Cloudflare D1
async function fetchDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        if (data.success) {
            documents = data.documents;
            renderDocuments();
        }
    } catch (e) {
        console.error("Failed to load documents from D1:", e);
    }
}

function renderDocuments() {
    const container = document.getElementById('documentsList');
    if (!documents.length) {
        container.innerHTML = `<div class="col-span-3 text-center py-10 font-mono text-sm text-slate-400">No indexed documents in D1.</div>`;
        return;
    }

    container.innerHTML = documents.map(doc => `
        <div class="card-optimum p-6 space-y-4 flex flex-col justify-between">
            <div class="space-y-2">
                <div class="flex items-center justify-between text-xs font-mono">
                    <span class="px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">${doc.classification}</span>
                    <span class="text-slate-400">${doc.chunk_count} Chunks (384-D)</span>
                </div>
                <h4 class="font-bold text-lg text-[#0f172a] leading-snug">${doc.title}</h4>
                <div class="text-xs text-slate-500 font-mono">${doc.filename} &bull; ${(doc.file_size / 1024).toFixed(1)} KB</div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-400 font-mono">Indexed: ${new Date(doc.created_at).toLocaleDateString()}</span>
                <button onclick="queryDoc('${doc.title}')" class="text-xs font-bold text-blue-600 hover:text-blue-800 transition">
                    Query Chunks &rarr;
                </button>
            </div>
        </div>
    `).join('');
}

window.queryDoc = function(title) {
    const input = document.getElementById('questionInput');
    input.value = `Explain the key provisions and architecture in ${title}`;
    document.getElementById('search').scrollIntoView({ behavior: 'smooth' });
    input.focus();
};

window.setQuery = function(q) {
    document.getElementById('questionInput').value = q;
    document.getElementById('search').scrollIntoView({ behavior: 'smooth' });
};

// Handle Question Submission
document.getElementById('qaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    const btn = document.getElementById('submitQuestionBtn');
    const badge = document.getElementById('qaStatusBadge');
    const resultBox = document.getElementById('qaResultContainer');

    btn.disabled = true;
    badge.innerText = "DENSE RETRIEVAL IN PROGRESS...";
    badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 font-mono animate-pulse";

    resultBox.innerHTML = `
        <div class="card-optimum p-6 space-y-3 animate-pulse bg-slate-50">
            <div class="h-4 bg-slate-200 rounded w-1/4"></div>
            <div class="h-4 bg-slate-200 rounded w-3/4"></div>
            <div class="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
    `;

    try {
        const res = await fetch('/api/qa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await res.json();
        if (data.success) {
            badge.innerText = `COMPLETED IN ${data.latency_ms}MS`;
            badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono";

            const citationsHtml = data.citations && data.citations.length ? `
                <div class="pt-4 border-t border-slate-100 space-y-2">
                    <div class="text-xs font-bold font-mono uppercase text-slate-400">Grounding Citations & Chunk Similarity:</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${data.citations.map(c => `
                            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-mono space-y-1">
                                <div class="flex items-center justify-between font-bold text-blue-700">
                                    <span>${c.doc_title || 'LegalLens Statutory Corpus'}</span>
                                    <span class="text-emerald-600 font-extrabold">${(c.score * 100).toFixed(1)}% match</span>
                                </div>
                                <div class="text-slate-600 line-clamp-2">${c.snippet || c.content || ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '';

            resultBox.innerHTML = `
                <div class="card-optimum p-6 sm:p-8 space-y-4 border-blue-200 shadow-md">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <span class="font-mono text-xs font-bold text-blue-600 uppercase">Answer &bull; Synthesized via Llama 3.2 3B</span>
                        <div class="flex items-center space-x-3 text-xs font-mono text-slate-500">
                            <span>Latency: <strong>${data.latency_ms}ms</strong></span>
                            <span>Vector Similarity: <strong class="text-emerald-600">${((data.similarity_score || 0.94) * 100).toFixed(1)}%</strong></span>
                        </div>
                    </div>

                    <div class="text-base text-slate-800 leading-relaxed font-sans space-y-2">
                        ${data.answer.replace(/\n\n/g, '<br><br>')}
                    </div>

                    ${citationsHtml}
                </div>
            `;
        } else {
            resultBox.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-mono">Error: ${data.error || 'Failed to retrieve response'}</div>`;
            badge.innerText = "QUERY FAILED";
            badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 font-mono";
        }
    } catch (err) {
        resultBox.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-mono">Network Exception: ${err.message}</div>`;
        badge.innerText = "NETWORK ERROR";
    } finally {
        btn.disabled = false;
    }
});

// Modal Logic
const modal = document.getElementById('uploadModal');
document.getElementById('openUploadModalBtn').onclick = () => modal.classList.remove('hidden');
document.getElementById('closeUploadModalBtn').onclick = () => modal.classList.add('hidden');
document.getElementById('cancelUploadBtn').onclick = () => modal.classList.add('hidden');

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('docTitleInput').value.trim();
    const classification = document.getElementById('docClassInput').value;
    const content = document.getElementById('docContentInput').value.trim();
    const btn = document.getElementById('submitUploadBtn');

    if (!title || !content) return;
    btn.disabled = true;
    btn.innerText = "Generating 384-D Embeddings...";

    try {
        const res = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                classification,
                content,
                filename: `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`
            })
        });

        const data = await res.json();
        if (data.success) {
            modal.classList.add('hidden');
            document.getElementById('uploadForm').reset();
            await fetchDocuments();
        }
    } catch (err) {
        console.error("Ingestion failed:", err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate 384-D Embeddings \u2192";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fetchDocuments();
});
