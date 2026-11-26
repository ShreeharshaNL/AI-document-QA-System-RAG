// OptimumSync Document Intelligence Controller
let documents = [];

const domainData = {
    enterprise: {
        title: "Enterprise Legal",
        desc: "Robust statutory issue detection over IT Act 2000, Bharatiya Nyaya Sanhita (BNS) 2023, and Consumer Protection Act.",
        query: "How does LegalLens classify digital financial fraud under IT Act 2000 and BNS 2023?",
        caseStudy: "Statutory Fraud Detection Architecture"
    },
    finance: {
        title: "Finance & FinTech",
        desc: "Automated compliance verification under Sarbanes-Oxley (SOX) Section 404 and FinTech consumer protections.",
        query: "What are the internal financial control requirements under SOX Section 404?",
        caseStudy: "SOX 404 Auditing Framework"
    },
    distributed: {
        title: "Distributed Systems",
        desc: "Asynchronous microservices orchestration, Kafka Outbox patterns, and Saga compensating rollbacks.",
        query: "What compensating transaction occurs in the Saga workflow when inventory depletion happens?",
        caseStudy: "Kafka Saga Rollback Mechanics"
    },
    healthcare: {
        title: "Healthcare (HIPAA)",
        desc: "Technical safeguard specifications and encryption standards under HIPAA Security Rule 45 CFR 164.312.",
        query: "What technical safeguards are mandated by HIPAA Security Rule 45 CFR 164.312?",
        caseStudy: "ePHI Data Protection Controls"
    }
};

window.switchDomain = function(domainKey) {
    const data = domainData[domainKey];
    if (!data) return;

    ['enterprise', 'finance', 'distributed', 'healthcare'].forEach(key => {
        const el = document.getElementById(`tab-${key}`);
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
                <div class="mt-4 pt-3 border-t border-white/20 text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center space-x-1.5">
                    <span>— CASE STUDIES: ${data.caseStudy}</span>
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
        container.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-400 font-mono text-sm">No indexed corpus found in D1.</div>`;
        return;
    }

    container.innerHTML = documents.map(d => `
        <div class="card-optimum p-6 space-y-3">
            <div class="flex items-center justify-between text-xs font-mono text-slate-500">
                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    ${d.classification || 'CORPUS'}
                </span>
                <span>${(d.file_size / 1024).toFixed(1)} KB</span>
            </div>
            <h4 class="font-bold text-lg text-[#0f172a] leading-snug">${d.title}</h4>
            <div class="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between font-mono">
                <span>D1 Storage: Active</span>
                <span class="font-bold text-slate-700">${d.chunk_count} Chunks</span>
            </div>
        </div>
    `).join('');
}

window.setQuery = function(text) {
    document.getElementById('questionInput').value = text;
    document.getElementById('submitQuestionBtn').click();
};

// QA Query Submission
document.getElementById('qaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    const btn = document.getElementById('submitQuestionBtn');
    const badge = document.getElementById('qaStatusBadge');
    const container = document.getElementById('qaResultContainer');

    btn.disabled = true;
    badge.innerText = "QUERYING D1 VECTOR MESH...";
    badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 font-mono animate-pulse";

    container.innerHTML = `
        <div class="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 font-mono text-sm text-slate-600">
            <div class="flex items-center space-x-2 text-blue-600 font-bold">
                <span class="h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping"></span>
                <span>1. Generating dense vector embedding via @cf/baai/bge-small-en-v1.5...</span>
            </div>
            <div class="text-slate-500 pl-4">&rarr; 2. Computing cosine distance (<=>) over Cloudflare D1 document chunks...</div>
            <div class="text-slate-500 pl-4">&rarr; 3. Prompting Llama 3.2 3B Instruct with top verified context...</div>
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
            badge.innerText = `GROUNDED CITATION (${topSim}% MATCH)`;
            badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono";

            const citationsHtml = data.citations.map((c, idx) => {
                const score = (c.similarityScore * 100).toFixed(1);
                return `
                    <div class="p-4 bg-white rounded-xl border border-slate-200 text-sm space-y-2 shadow-sm">
                        <div class="flex items-center justify-between text-xs font-mono">
                            <span class="font-bold text-[#0f172a]">[Citation ${idx + 1}] ${c.documentTitle || c.documentId} &bull; Page ${c.pageNumber}</span>
                            <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                ${score}% Match
                            </span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-gradient-to-r from-blue-600 to-emerald-500 h-1.5 rounded-full" style="width: ${score}%"></div>
                        </div>
                        <p class="text-slate-600 text-xs leading-relaxed pt-1 border-t border-slate-100">&ldquo;${c.content}&rdquo;</p>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <!-- Inquiry Formulation -->
                <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Inquiry</div>
                    <div class="text-base font-semibold text-[#0f172a]">${data.question}</div>
                </div>

                <!-- Grounded Answer Card -->
                <div class="card-optimum p-6 sm:p-8 space-y-4 border border-blue-100 shadow-md">
                    <div class="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-100 pb-3">
                        <span class="text-blue-600 font-bold flex items-center space-x-1.5">
                            <span class="h-2 w-2 rounded-full bg-blue-600"></span>
                            <span>Grounded Synthesis &bull; Llama 3.2 3B Instruct</span>
                        </span>
                        <span>Latency: <strong class="text-emerald-600 font-bold">${data.latencyMs}ms</strong></span>
                    </div>
                    <div id="streamingAnswerText" class="text-lg text-slate-800 leading-relaxed font-normal"></div>
                </div>

                <!-- Citations -->
                <div class="space-y-3 pt-2">
                    <div class="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Auditable Source Citations (Dense Cosine Similarity)
                    </div>
                    ${citationsHtml}
                </div>
            `;

            streamTypewriter(data.answer, document.getElementById('streamingAnswerText'));

        } else {
            badge.innerText = "QUERY ERROR";
            badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200 font-mono";
            container.innerHTML = `<div class="p-6 bg-red-50 text-red-700 rounded-2xl font-mono text-sm border border-red-200">${data.answer || data.error}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="p-6 bg-red-50 text-red-700 rounded-2xl font-mono text-sm border border-red-200">Error: ${err.message}</div>`;
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

// Ingest Modal Handling
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
    submitBtn.innerText = "Generating 384-D Embeddings...";

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
            await fetchDocuments();
        }
    } catch (err) {
        console.error("Upload error:", err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Generate 384-D Embeddings \u2192";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fetchDocuments();
});
