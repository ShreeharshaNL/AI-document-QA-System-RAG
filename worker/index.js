// Cloudflare Edge Worker for AI Document Q&A System (RAG)
function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (path.startsWith('/api/')) {
            const apiPath = path.replace(/^\/api/, '');
            const db = env.DB;
            const ai = env.AI;

            if (!db) {
                return new Response(JSON.stringify({ error: "D1 database 'DB' not configured" }), { status: 500, headers: corsHeaders });
            }

            try {
                // GET /api/health
                if (apiPath === '/health') {
                    return new Response(JSON.stringify({
                        status: "HEALTHY",
                        system: "Aura Dense Retrieval & RAG System",
                        models: {
                            llm: "@cf/meta/llama-3.2-3b-instruct",
                            embeddings: "@cf/baai/bge-small-en-v1.5",
                            dimensions: 384,
                            distanceMetric: "COSINE_DISTANCE (<=>)"
                        },
                        database: "CLOUDFLARE_D1_EDGE_SQL",
                        timestamp: new Date().toISOString()
                    }), { headers: corsHeaders });
                }

                // GET /api/documents
                if (apiPath === '/documents' && method === 'GET') {
                    const { results } = await db.prepare("SELECT * FROM documents ORDER BY created_at ASC").all();
                    return new Response(JSON.stringify({ success: true, documents: results }), { headers: corsHeaders });
                }

                // GET /api/chunks
                if (apiPath.startsWith('/chunks') && method === 'GET') {
                    const docId = url.searchParams.get('documentId');
                    let query = "SELECT id, document_id, chunk_index, page_number, content, token_count FROM document_chunks";
                    if (docId) {
                        const { results } = await db.prepare(query + " WHERE document_id = ? ORDER BY chunk_index ASC").bind(docId).all();
                        return new Response(JSON.stringify({ success: true, chunks: results }), { headers: corsHeaders });
                    }
                    const { results } = await db.prepare(query + " ORDER BY chunk_index ASC LIMIT 20").all();
                    return new Response(JSON.stringify({ success: true, chunks: results }), { headers: corsHeaders });
                }

                // POST /api/documents/upload
                if (apiPath === '/documents/upload' && method === 'POST') {
                    const body = await request.json();
                    const { title, content, classification = 'ENGINEERING_SPEC' } = body;
                    if (!title || !content) {
                        return new Response(JSON.stringify({ error: "Title and content required" }), { status: 400, headers: corsHeaders });
                    }

                    const docId = 'doc-' + crypto.randomUUID().substring(0, 8);
                    const filename = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.pdf';
                    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 25);
                    const chunkTexts = paragraphs.length ? paragraphs : [content];

                    // Generate embeddings
                    let embeddings = [];
                    if (ai) {
                        const embRes = await ai.run('@cf/baai/bge-small-en-v1.5', { text: chunkTexts });
                        embeddings = embRes.data;
                    } else {
                        embeddings = chunkTexts.map(() => new Array(384).fill(0.01));
                    }

                    await db.prepare("INSERT INTO documents (id, user_id, title, filename, file_size, chunk_count, classification) VALUES (?, 'usr-shree', ?, ?, ?, ?, ?)")
                        .bind(docId, title, filename, content.length, chunkTexts.length, classification).run();

                    for (let i = 0; i < chunkTexts.length; i++) {
                        const chkId = 'chk-' + crypto.randomUUID().substring(0, 8);
                        await db.prepare("INSERT INTO document_chunks (id, document_id, chunk_index, page_number, content, embedding, token_count) VALUES (?, ?, ?, 1, ?, ?, ?)")
                            .bind(chkId, docId, i, chunkTexts[i], JSON.stringify(embeddings[i]), chunkTexts[i].split(/\s+/).length).run();
                    }

                    return new Response(JSON.stringify({ success: true, documentId: docId, title, chunksCreated: chunkTexts.length }), { headers: corsHeaders });
                }

                // POST /api/qa/ask
                if (apiPath === '/qa/ask' && method === 'POST') {
                    const { question, documentId } = await request.json();
                    if (!question || !question.trim()) {
                        return new Response(JSON.stringify({ error: "Question cannot be empty" }), { status: 400, headers: corsHeaders });
                    }

                    const startMs = Date.now();

                    // 1. Generate query embedding
                    let queryEmbedding;
                    if (ai) {
                        const embRes = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [question] });
                        queryEmbedding = embRes.data[0];
                    } else {
                        queryEmbedding = new Array(384).fill(0.01);
                    }

                    // 2. Fetch candidate chunks
                    let chunkQuery = "SELECT dc.*, d.title as doc_title FROM document_chunks dc JOIN documents d ON dc.document_id = d.id";
                    let allChunks;
                    if (documentId) {
                        const res = await db.prepare(chunkQuery + " WHERE dc.document_id = ?").bind(documentId).all();
                        allChunks = res.results;
                    } else {
                        const res = await db.prepare(chunkQuery).all();
                        allChunks = res.results;
                    }

                    if (!allChunks.length) {
                        return new Response(JSON.stringify({
                            success: false,
                            answer: "No indexed document chunks found in database. Please upload a corpus document.",
                            citations: []
                        }), { headers: corsHeaders });
                    }

                    // 3. Compute cosine similarity
                    const scoredChunks = allChunks.map(chk => {
                        const vec = JSON.parse(chk.embedding);
                        const sim = cosineSimilarity(queryEmbedding, vec);
                        return {
                            id: chk.id,
                            documentId: chk.document_id,
                            documentTitle: chk.doc_title,
                            chunkIndex: chk.chunk_index,
                            pageNumber: chk.page_number,
                            content: chk.content,
                            tokenCount: chk.token_count,
                            similarityScore: Number(sim.toFixed(4))
                        };
                    });

                    scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);
                    const topChunks = scoredChunks.slice(0, 3);

                    // 4. Grounded answer generation
                    const contextText = topChunks.map(c => `[Source: ${c.documentTitle} | Page ${c.pageNumber}]: ${c.content}`).join("\n\n");
                    let answer = "";

                    if (ai) {
                        const messages = [
                            {
                                role: "system",
                                content: "You are Aura, an enterprise technical and legal AI intelligence system. Answer the question directly, authoritatively, and concisely using the provided context excerpts. Cite specific statutes, documents, or architecture sections directly. Do not include conversational filler, notes, or meta commentary."
                            },
                            {
                                role: "user",
                                content: `Retrieved Context:\n${contextText}\n\nQuestion: ${question}`
                            }
                        ];

                        try {
                            const llmRes = await ai.run('@cf/meta/llama-3.2-3b-instruct', { messages, max_tokens: 280 });
                            answer = (llmRes.response || llmRes.choices?.[0]?.text || "").trim();
                        } catch (err) {
                            answer = `Based on verified excerpt from "${topChunks[0].documentTitle}": ${topChunks[0].content}`;
                        }
                    } else {
                        answer = `Grounded excerpt from ${topChunks[0].documentTitle}: ${topChunks[0].content}`;
                    }

                    const elapsed = Date.now() - startMs;

                    // 5. Store in history
                    const qaId = 'qa-' + crypto.randomUUID().substring(0, 8);
                    await db.prepare("INSERT INTO qa_history (id, document_id, question, answer, citations, similarity_score, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)")
                        .bind(qaId, documentId || 'all', question, answer, JSON.stringify(topChunks), topChunks[0]?.similarityScore || 0, elapsed).run();

                    return new Response(JSON.stringify({
                        success: true,
                        qaId,
                        question,
                        answer,
                        citations: topChunks,
                        latencyMs: elapsed
                    }), { headers: corsHeaders });
                }

                // GET /api/qa/history
                if (apiPath === '/qa/history' && method === 'GET') {
                    const { results } = await db.prepare("SELECT * FROM qa_history ORDER BY created_at DESC LIMIT 15").all();
                    return new Response(JSON.stringify({ success: true, history: results }), { headers: corsHeaders });
                }

                return new Response(JSON.stringify({ error: "Endpoint not found: " + apiPath }), { status: 404, headers: corsHeaders });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: corsHeaders });
            }
        }

        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }
        return new Response("Not Found", { status: 404 });
    }
};
