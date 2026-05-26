require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const saltRounds = 10;

const app = express();
app.use(cors({
    origin: '*', // Permite requisições do seu frontend (Vite)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-usuario-nivel']
}));

// CONFIGURAÇÃO: Aumentado o limite de recepção de JSON para suportar strings pesadas de Base64 (Assinatura Digital)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONFIGURAÇÃO DE UPLOADS (FOTOS) ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// -------------------------------------------------------------------------
// CONFIGURAÇÃO DO BANCO DE DADOS (POOLED CONTRA ECONNRESET)
// -------------------------------------------------------------------------
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = {
    query: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.query(sql, params, callback);
    },
    beginTransaction: (callback) => pool.getConnection((err, conn) => {
        if (err) return callback(err);
        conn.beginTransaction((err) => {
            if (err) { conn.release(); return callback(err); }
            conn.query = conn.query.bind(conn);
            callback(null, conn);
        });
    })
};

console.log('✅ Pool de conexões do MySQL configurado contra ECONNRESET!');

// -------------------------------------------------------------------------
// MIDDLEWARE DE CONTROLE DE ACESSO (RBAC) - VALIDAÇÃO DE PERMISSÕES
// -------------------------------------------------------------------------
const permitirApenas = (niveisPermitidos) => {
    return (req, res, next) => {
        const usuarioNivel = req.headers['x-usuario-nivel'];

        if (!usuarioNivel) {
            return res.status(401).json({ error: "Acesso não autorizado: Cabeçalho de privilégio ausente." });
        }

        const nivelLimpo = usuarioNivel.toLowerCase().trim();

        if (niveisPermitidos.includes(nivelLimpo)) {
            next();
        } else {
            console.warn(`⚠️ Bloqueio de Segurança: Nível '${nivelLimpo}' tentou acessar rota restrita: ${req.method} ${req.originalUrl}`);
            return res.status(403).json({ error: "Acesso negado: Seu perfil de usuário não tem permissão para esta ação." });
        }
    };
};

// -------------------------------------------------------------------------
// DASHBOARD - INCLUSÃO DE MÉTRICAS DE CONTROLE DE GASTOS (100% CORRIGIDO)
// -------------------------------------------------------------------------
app.get('/api/stats', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const queries = {
        totalEquipamentos: "SELECT COUNT(*) as total FROM equipamentos",
        chamadosAbertos: "SELECT COUNT(*) as total FROM chamados WHERE status = 'Aberto'",
        chamadosAndamento: "SELECT COUNT(*) as total FROM chamados WHERE status = 'Em Atendimento'",
        chamadosConcluidos: "SELECT COUNT(*) as total FROM chamados WHERE status = 'Concluído'",
        preventivasAtrasadas: `
            SELECT COUNT(*) as total FROM equipamentos
            WHERE periodicidade_preventiva > 0
            AND data_ultima_preventiva IS NOT NULL
            AND DATE_ADD(data_ultima_preventiva, INTERVAL periodicidade_preventiva DAY) <= CURDATE()`,
        porSetor: `
            SELECT s.nome, COUNT(c.id) as total
            FROM chamados c JOIN setores s ON c.setor_id = s.id
            GROUP BY s.id HAVING total > 0 ORDER BY total DESC`,
        porTecnico: `
            SELECT tecnico_responsavel as nome, COUNT(*) as total
            FROM chamados WHERE tecnico_responsavel IS NOT NULL AND tecnico_responsavel != ''
            GROUP BY tecnico_responsavel ORDER BY total DESC`,
        recentes: "SELECT id, titulo, status, data_abertura FROM chamados ORDER BY id DESC LIMIT 6",

        // 🆕 1. Gasto total com Filtros (Fazendo JOIN correto com itens_estoque)
        gastoFiltros: `
           SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0) as total 
           FROM chamados_itens ci
           JOIN itens_estoque i ON ci.item_id = i.id
           WHERE i.tipo = 'Filtro'`,

        // 🆕 2. Gasto com Insumos Gerais (Tudo que não contiver a palavra Filtro)
        gastoInsumosGerais: `
            SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0) as total 
            FROM chamados_itens ci
            JOIN itens_estoque i ON ci.item_id = i.id
            WHERE i.tipo != 'Filtro'`,

        // 🆕 3. Gasto Total em Equipamentos (Baseado na categoria 'Manutenção' da tabela chamados)
        gastoTotalEquipamentos: `
            SELECT IFNULL(SUM(custo_servico), 0) as total 
            FROM chamados 
            WHERE categoria = 'Manutenção'`,

        // 🆕 4. Gasto Total em Estrutura / TI (Baseado na categoria 'TI' da tabela chamados)
        gastoTotalEstrutura: `
            SELECT IFNULL(SUM(custo_servico), 0) as total 
            FROM chamados 
            WHERE categoria = 'TI'`
    };

    const promises = Object.keys(queries).map(key => {
        return new Promise((resolve) => {
            db.query(queries[key], (err, results) => {
                if (err) {
                    // Impede que uma query com erro quebre o Promise.all inteiro (Evita Erro 500)
                    console.error(`⚠️ Erro silencioso na query [${key}]:`, err.message);
                    resolve({ key, data: [{ total: 0 }] });
                } else {
                    resolve({ key, data: results });
                }
            });
        });
    });

    Promise.all(promises)
        .then(results => {
            const stats = {};
            results.forEach(r => { 
                // Se for uma das novas métricas financeiras, extrai direto o valor numérico puro
                if (['gastoFiltros', 'gastoInsumosGerais', 'gastoTotalEquipamentos', 'gastoTotalEstrutura'].includes(r.key)) {
                    stats[r.key] = r.data[0]?.total || 0;
                } else {
                    stats[r.key] = r.data; 
                }
            });
            res.json(stats);
        })
        .catch(err => {
            console.error("❌ Falha crítica no Promise.all da Dashboard:", err.message);
            res.status(500).json({ error: err.message });
        });
});

// -------------------------------------------------------------------------
// FUNÇÕES AUXILIARES
// -------------------------------------------------------------------------
const enviarTelegram = async (mensagem) => {
    const token = process.env.TELEGRAM_TOKEN;
    const chat_id = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat_id) {
        console.error("❌ Telegram não configurado no .env");
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await axios.post(url, { chat_id, text: mensagem, parse_mode: 'Markdown' });
        console.log("✅ Notificação enviada ao Telegram");
    } catch (err) {
        console.error("❌ Erro ao enviar Telegram:", err.message);
    }
};

// -------------------------------------------------------------------------
// ROTAS DE EQUIPAMENTOS - PADRONIZADAS E CORRIGIDAS (SUPORTA FOTO E FORM-DATA)
// -------------------------------------------------------------------------
app.get('/api/equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id ORDER BY e.id DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// 🟢 CORRIGIDO: Adicionado upload.single('foto_equipamento') para ler o FormData do Modal e da Sidebar
app.post('/api/equipamentos', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva } = req.body;
    
    // Captura o arquivo de foto se ele foi enviado
    const foto_equipamento = req.file ? `/uploads/${req.file.filename}` : null;

    // Sanatização rigorosa de tipos contra valores vazios do form-data
    const v_nome = nome && nome.trim() !== "" ? nome : 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio : 'S/P';
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';

    // Query atualizada incluindo o campo da foto no inventário de ativos
    const query = `INSERT INTO equipamentos (nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva, foto_equipamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`;
    const values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_periodicidade, foto_equipamento];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro interno do MySQL no POST de equipamentos:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Sucesso!", id: result.insertId });
    });
});

app.put('/api/equipamentos/:id', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { id } = req.params;
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva } = req.body;
    
    const v_nome = nome || 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio : 'S/P';
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';

    let query, values;

    if (req.file) {
        const foto_equipamento = `/uploads/${req.file.filename}`;
        query = `UPDATE equipamentos SET nome=?, modelo=?, patrimonio=?, num_serie=?, fabricante=?, setor_id=?, status=?, tipo_id=?, periodicidade_preventiva=?, foto_equipamento=? WHERE id=?`;
        values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_periodicidade, foto_equipamento, id];
    } else {
        query = `UPDATE equipamentos SET nome=?, modelo=?, patrimonio=?, num_serie=?, fabricante=?, setor_id=?, status=?, tipo_id=?, periodicidade_preventiva=? WHERE id=?`;
        values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_periodicidade, id];
    }

    db.query(query, values, (err) => {
        if (err) {
            console.error("❌ Erro interno do MySQL no PUT de equipamentos:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Dados updated com sucesso!" });
    });
});

app.delete('/api/equipamentos/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query(`DELETE FROM equipamentos WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Removido com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE CHAMADOS / OS
// -------------------------------------------------------------------------
app.get('/api/chamados', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT c.*, s.nome as setor_nome, e.nome as equip_nome, e.patrimonio as equip_pat
        FROM chamados c
        LEFT JOIN setores s ON c.setor_id = s.id
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        ORDER BY
            CASE
                WHEN c.status = 'Aberto' THEN 1
                WHEN c.status = 'Em Atendimento' THEN 2
                WHEN c.status = 'Concluído' THEN 3
                ELSE 4
            END,
            c.data_abertura DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.get('/api/chamados/:id', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { id } = req.params;

    const queryChamado = `
        SELECT c.*, e.patrimonio, e.num_serie, e.nome as eq_nome, 
               e.modelo, e.fabricante, s.nome as setor_nome,
               f.nome_fantasia as empresa_terceirizada
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN setores s ON c.setor_id = s.id
        LEFT JOIN fornecedores f ON c.fornecedor_id = f.id
        WHERE c.id = ?
    `;

    db.query(queryChamado, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });

        const chamado = results[0];
        const queryHist = `SELECT * FROM chamados_historico WHERE chamado_id = ? ORDER BY data_registro DESC`;
        db.query(queryHist, [id], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            chamado.historico = logs || [];
            
            const queryItens = `
                SELECT ci.quantidade, ci.valor_unitario_na_epoca AS valor_unitario, ie.nome 
                FROM chamados_itens ci
                JOIN itens_estoque ie ON ci.item_id = ie.id
                WHERE ci.chamado_id = ?
            `;
            db.query(queryItens, [id], (errItens, items) => {
                if (errItens) return res.status(500).json({ error: errItens.message });
                chamado.itens_vinculados = items || [];
                res.json(chamado);
            });
        });
    });
});

app.post('/api/chamados', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), upload.single('foto'), (req, res) => {
    const { setor_id, equipamento_id, titulo, descricao_problema, prioridade, category, categoria, tipo_manutencao } = req.body;
    const foto_abertura = req.file ? `/uploads/${req.file.filename}` : null;

    const categoriaFinal = categoria || category || 'Manutenção';

    // 🟢 Tratamento contra strings nulas vindas do FormData no redirecionamento do Prontuário
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" && setor_id !== "undefined" ? Number(setor_id) : null;
    const v_equipamento_id = equipamento_id && equipamento_id !== "" && equipamento_id !== "null" && equipamento_id !== "undefined" ? Number(equipamento_id) : null;

    const query = `INSERT INTO chamados (setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao, foto_abertura, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [v_setor_id, v_equipamento_id, titulo, descricao_problema, prioridade || 'Média', categoriaFinal, tipo_manutencao || 'Corretiva', foto_abertura];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const novaOsId = result.insertId;

        // 🟢 Query estendida com JOIN para carregar os dados do equipamento no Bot do Telegram
        const queryDadosTelegram = `
            SELECT c.id, c.titulo, DATE_FORMAT(c.data_abertura, '%d/%m/%Y às %H:%i') as hora_formatada, 
                   s.nome as setor_nome, e.nome as equip_nome, e.patrimonio as equip_pat
            FROM chamados c
            LEFT JOIN setores s ON c.setor_id = s.id
            LEFT JOIN equipamentos e ON c.equipamento_id = e.id
            WHERE c.id = ?
        `;

        db.query(queryDadosTelegram, [novaOsId], (errTelegram, resultsTelegram) => {
            if (!errTelegram && resultsTelegram.length > 0) {
                const dados = resultsTelegram[0];

                const textoTelegram =
                    `🚨 *NOVA ORDEM DE SERVIÇO* 🚨\n\n` +
                    `🎫 *Número da OS:* #${dados.id}\n` +
                    `📍 *Setor:* ${dados.setor_nome || 'Não Informado'}\n` +
                    `⚙️ *Ativo:* ${dados.equip_nome ? `${dados.equip_nome} (PAT: ${dados.equip_pat || 'S/P'})` : 'Nenhum ativo vinculado'}\n` +
                    `📝 *Assunto:* ${dados.titulo}\n` +
                    `⏰ *Hora de Abertura:* ${dados.hora_formatada}`;

                enviarTelegram(textoTelegram);
            } else {
                enviarTelegram(`🚨 *NOVA OS #${novaOsId}*\n📝 *Assunto:* ${titulo}`);
            }
        });

        res.json({ message: "Chamado aberto!", id: novaOsId });
    });
});

app.put('/api/chamados/:id/atualizar', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { status, tipo_atendimento, descricao_solucao, fornecedor_id, nf_referencia, custo_servico, tecnico_responsavel } = req.body;
    const tecnico_nome = tecnico_responsavel || "Técnico do Sistema";

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE chamados
            SET status = ?, tipo_atendimento = ?, tecnico_responsavel = ?, fornecedor_id = ?, nf_referencia = ?, custo_servico = ?,
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;
        const valuesUpdate = [status, tipo_atendimento, tecnico_nome, fornecedor_id || null, nf_referencia || null, custo_servico || 0, status, id];

        conn.query(queryUpdate, valuesUpdate, (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: err.message }); });

            if (descricao_solucao && descricao_solucao.trim() !== "") {
                const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
                conn.query(queryHist, [id, tecnico_nome, descricao_solucao, status], (err) => {
                    if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: err.message }); });

                    conn.commit((err) => {
                        if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: err.message }); });
                        conn.release();
                        res.json({ message: "Chamado e cronologia atualizados com sucesso!" });
                    });
                });
            } else {
                conn.commit((err) => {
                    if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: err.message }); });
                    conn.release();
                    res.json({ message: "Chamado updated!" });
                });
            }
        });
    });
});

app.post('/api/chamados/:id/itens', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { item_id, quantidade = 0 } = req.body;

    const qtd_solicitada = Number(quantidade);

    if (!id || id === "0" || id === "null" || id === "undefined") {
        return res.status(400).json({ error: "Não é possível vincular uma peça sem uma Ordem de Serviço (OS) válida aberta." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT id FROM chamados WHERE id = ?", [id], (errChamado, chamadoExiste) => {
            if (errChamado) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errChamado.message }); });
            
            if (chamadoExiste.length === 0) {
                return conn.rollback(() => { 
                    conn.release(); 
                    res.status(400).json({ error: `A Ordem de Serviço OS #${id} não existe no sistema. Verifique os dados.` }); 
                });
            }

            conn.query("SELECT nome, quantidade, valor_unitario FROM itens_estoque WHERE id = ?", [item_id], (errEstoque, results) => {
                if (errEstoque || results.length === 0) {
                    return conn.rollback(() => { conn.release(); res.status(400).json({ error: "Item de insumo não localizado no almoxarifado." }); });
                }

                const item = results[0];
                if (item.quantidade < qtd_solicitada) {
                    return conn.rollback(() => { conn.release(); res.status(400).json({ error: `Estoque insuficiente! Saldo atual: ${item.quantidade} un.` }); });
                }

                const queryIns = "INSERT INTO chamados_itens (chamado_id, item_id, quantidade, valor_unitario_na_epoca) VALUES (?, ?, ?, ?)";
                conn.query(queryIns, [id, item_id, qtd_solicitada, item.valor_unitario], (errIns) => {
                    if (errIns) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errIns.message }); });

                    conn.query("UPDATE itens_estoque SET quantidade = quantidade - ? WHERE id = ?", [qtd_solicitada, item_id], (errDeduz) => {
                        if (errDeduz) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errDeduz.message }); });

                        const msgEstoque = `Peça utilizada: ${qtd_solicitada}x ${item.nome}`;
                        const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, 'Sistema', ?, 'Em Atendimento', NOW())";

                        conn.query(queryHist, [id, msgEstoque], (errHist) => {
                            if (errHist) return conn.rollback(() => { res.status(500).json({ error: errHist.message }); });
                            
                            conn.commit((errCommit) => {
                                if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                conn.release();
                                res.json({ message: "Estoque deduzido e associado à OS com sucesso!" });
                            });
                        });
                    });
                });
            });
        });
    });
});

app.patch('/api/chamados/:id/finalizar', permitirApenas(['admin', 'coordenador', 'tecnico']), upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { status, tecnico_responsavel, descricao_solucao, tipo_atendimento } = req.body;
    const foto_conclusao = req.file ? `/uploads/${req.file.filename}` : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json(err);

        const queryUpdate = `
            UPDATE chamados
            SET status = ?, tecnico_responsavel = ?, descricao_solucao = ?, tipo_atendimento = ?,
                foto_conclusao = COALESCE(?, foto_conclusao),
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;
        conn.query(queryUpdate, [status, tecnico_responsavel, descricao_solucao, tipo_atendimento, foto_conclusao, status, id], (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });

            const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
            const msgHist = descricao_solucao || `Status alterado para ${status}`;

            conn.query(queryHist, [id, tecnico_responsavel, msgHist, status], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
                conn.commit(err => {
                    if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
                    conn.release();
                    res.json({ message: "Sucesso!" });
                });
            });
        });
    });
});

app.patch('/api/chamados/:id/observacao', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const { nova_obs, usuario_nome, usuario_nivel } = req.body;
    const niveisPermitidos = ['admin', 'coordenador'];
    if (!niveisPermitidos.includes(usuario_nivel?.toLowerCase())) {
        return res.status(403).json({ error: "Acesso negado: Apenas gestores podem adicionar notas." });
    }

    const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const carimbo = `\n\n--- ${data} (${usuario_nome} | ${usuario_nivel}) ---\n${nova_obs}`;
    const query = `UPDATE chamados SET observacao_coordenador = CONCAT(COALESCE(observacao_coordenador, ''), ?) WHERE id = ?`;

    db.query(query, [carimbo, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Nota adicionada com sucesso!" });
    });
});

// ROTA DE ASSINATURA CORRIGIDA: Agora grava a imagem E o nome por extenso digitado
app.patch('/api/chamados/:id/assinar', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { id } = req.params;
    const { tipo, signatureBase64, assinaturaBase64, nome } = req.body; // Aceita tanto o nome antigo do body quanto as variações

    // Normaliza qual imagem base64 usar (para o caso de variação de nome de variável vinda do formulário)
    const imagemAssinatura = assinaturaBase64 || signatureBase64;
    const nomeDigitado = nome || req.body.nome_digitado;

    if (!imagemAssinatura) {
        return res.status(400).json({ error: "Dados da assinatura digital ausentes." });
    }

    // Define dinamicamente as colunas exatas reveladas pelo DESCRIBE do banco
    const campoAssinatura = tipo === 'tecnico' ? 'assinatura_tecnico' : 'assinatura_setor';
    const campoNomeExtenso = tipo === 'tecnico' ? 'nome_tecnico' : 'nome_setor';

    // Monta a query injetando as duas colunas correspondentes
    const query = `UPDATE chamados SET ${campoAssinatura} = ?, ${campoNomeExtenso} = ? WHERE id = ?`;

    db.query(query, [imagemAssinatura, nomeDigitado || null, id], (err, result) => {
        if (err) {
            console.error("❌ Erro no MySQL ao salvar assinatura e nome:", err.message);
            return res.status(500).json({ error: err.message });
        }
        return res.status(200).json({ message: "Assinatura e nome por extenso arquivados com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE PREVENTIVAS
// -------------------------------------------------------------------------
app.get('/api/preventivas', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `
        SELECT e.id, e.nome, e.patrimonio, e.setor_id, s.nome as setor_nome, t.nome as tipo_nome,
               e.data_ultima_preventiva, e.periodicidade_preventiva,
               DATE_ADD(e.data_ultima_preventiva, INTERVAL e.periodicidade_preventiva DAY) as data_vencimento,
               DATEDIFF(DATE_ADD(e.data_ultima_preventiva, INTERVAL e.periodicidade_preventiva DAY), CURDATE()) as dias_restantes
        FROM equipamentos e
        JOIN tipos_equipamentos t ON e.tipo_id = t.id
        LEFT JOIN setores s ON e.setor_id = s.id
        WHERE e.periodicidade_preventiva > 0 AND e.data_ultima_preventiva IS NOT NULL
        ORDER BY data_vencimento ASC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/preventivas/baixa', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { equipamento_id, relatorio_tecnico, tecnico_nome } = req.body;
    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json(err);
        conn.query("UPDATE equipamentos SET data_ultima_preventiva = CURDATE() WHERE id = ?", [equipamento_id], (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
            const historicoTexto = `[ID EQUIP: ${equipamento_id}] RELATÓRIO DE PREVENTIVA: ${relatorio_tecnico}`;
            const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (NULL, ?, ?, 'Preventiva Realizada', NOW())";
            conn.query(queryHist, [tecnico_nome || 'Técnico', historicoTexto], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
                conn.commit(err => {
                    if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
                    conn.release();
                    res.json({ message: "Baixa de preventiva registrada!" });
                });
            });
        });
    });
});

// -------------------------------------------------------------------------
// PRONTUÁRIO
// -------------------------------------------------------------------------
app.get('/api/equipamentos/:id/prontuario', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const queryEquip = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id WHERE e.id = ?`;
    const queryTimeline = `
        (SELECT data_abertura as data, titulo as evento, 'Abertura OS' as tipo, 'Usuário' as responsavel, status, id as ref_id FROM chamados WHERE equipamento_id = ?)
        UNION
        (SELECT h.data_registro as data, h.texto_historico as evento, 'Intervenção Técnica' as tipo, h.tecnico_nome as responsavel, h.status_momento as status, c.id as ref_id
         FROM chamados_historico h JOIN chamados c ON h.chamado_id = c.id WHERE c.equipamento_id = ?)
        UNION
        (SELECT data_registro as data, texto_historico as evento, 'Preventiva' as tipo, tecnico_nome as responsavel, status_momento as status, 0 as ref_id
         FROM chamados_historico WHERE texto_historico LIKE CONCAT('%[ID EQUIP: ', ?, ']%'))
        UNION
        (SELECT data_movimentacao as data, descricao_log as evento, 'Movimentação' as tipo, tecnico_nome as responsavel, status_novo as status, 0 as ref_id
         FROM equipamentos_historico WHERE equipamento_id = ?)
        ORDER BY data DESC
    `;
    db.query(queryEquip, [id], (err, equip) => {
        if (err) return res.status(500).json(err);
        if (equip.length === 0) return res.status(404).json({ message: "Não encontrado" });
        db.query(queryTimeline, [id, id, id, id], (err, timeline) => {
            const queryCusto = `
                SELECT (SELECT IFNULL(SUM(custo_servico), 0) FROM chamados WHERE equipamento_id = ? AND status = 'Concluído') +
                        (SELECT IFNULL(SUM(quantidade * valor_unitario_na_epoca), 0) FROM chamados_itens ci JOIN chamados c ON ci.chamado_id = c.id WHERE c.equipamento_id = ?)
                as total`;
            db.query(queryCusto, [id, id], (err, custo) => {
                if (err) return res.status(500).json(err);
                res.json({ dados: equip[0], timeline, custoAcumulado: custo[0].total || 0 });
            });
        });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE USUÁRIOS
// -------------------------------------------------------------------------
app.get('/api/usuarios', permitirApenas(['admin']), (req, res) => {
    db.query("SELECT id, nome, login, nivel FROM usuarios ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/usuarios', permitirApenas(['admin']), async (req, res) => {
    const { nome, login, senha, nivel } = req.body;
    try {
        const hash = await bcrypt.hash(senha, saltRounds);
        const query = "INSERT INTO usuarios (nome, login, senha, nivel) VALUES (?, ?, ?, ?)";
        db.query(query, [nome, login, hash, nivel], (err) => {
            if (err) return res.status(400).json({ error: "Login já em uso." });
            res.json({ message: "Usuário criado!" });
        });
    } catch (err) {
        res.status(500).json(err);
    }
});

app.put('/api/usuarios/:id', permitirApenas(['admin']), async (req, res) => {
    const { id } = req.params;
    const { nome, login, nivel, senha_nova } = req.body;
    try {
        if (senha_nova) {
            const hash = await bcrypt.hash(senha_nova, saltRounds);
            const query = "UPDATE usuarios SET nome=?, login=?, nivel=?, senha=? WHERE id=?";
            db.query(query, [nome, login, nivel, hash, id], (err) => {
                if (err) return res.status(400).json(err);
                res.json({ message: "Usuário e senha updated!" });
            });
        } else {
            const query = "UPDATE usuarios SET nome=?, login=?, nivel=? WHERE id=?";
            db.query(query, [nome, login, nivel, id], (err) => {
                if (err) return res.status(400).json(err);
                res.json({ message: "Usuário atualizado!" });
            });
        }
    } catch (err) {
        res.status(500).json(err);
    }
});

app.delete('/api/usuarios/:id', permitirApenas(['admin']), (req, res) => {
    const { id } = req.params;
    if (id == "1") return res.status(403).json({ error: "Não é possível excluir o administrador mestre." });
    db.query("DELETE FROM usuarios WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Removido!" });
    });
});

app.post('/api/login', (req, res) => {
    const { login, senha } = req.body;
    const query = "SELECT * FROM usuarios WHERE LOWER(login) = LOWER(?) LIMIT 1";

    db.query(query, [login], async (err, results) => {
        if (err) return res.status(500).json({ error: "Erro no banco" });
        if (results.length === 0) return res.status(401).json({ error: "Usuário não encontrado" });

        const user = results[0];
        const senhaCorreta = await bcrypt.compare(senha, user.senha);

        if (senhaCorreta) {
            res.json({ id: user.id, nome: user.nome, nivel: user.nivel });
        } else {
            res.status(401).json({ error: "Senha incorreta" });
        }
    });
});

app.patch('/api/usuarios/alterar-senha', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), async (req, res) => {
    const { id, senhaAtual, novaSenha } = req.body;

    if (!id || !senhaAtual || !novaSenha) {
        return res.status(400).json({ error: "Preencha todos os campos." });
    }

    db.query("SELECT senha FROM usuarios WHERE id = ?", [id], async (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Usuário não encontrado." });

        const hashBanco = results[0].senha;
        try {
            const senhaOk = await bcrypt.compare(senhaAtual, hashBanco);
            if (!senhaOk) {
                return res.status(401).json({ error: "A senha atual está incorreta." });
            }

            const novoHash = await bcrypt.hash(novaSenha, saltRounds);
            db.query("UPDATE usuarios SET senha = ? WHERE id = ?", [novoHash, id], (err) => {
                if (err) return res.status(500).json({ error: "Erro ao salvar nova senha." });
                res.json({ message: "Senha alterada com sucesso!" });
            });
        } catch (e) {
            res.status(500).json({ error: "Erro interno no servidor." });
        }
    });
});

// -------------------------------------------------------------------------
// RELATÓRIOS GERAIS
// -------------------------------------------------------------------------
app.get('/api/relatorios/inventario-geral', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { data_inicio, data_fim, setor_id } = req.query;

    const inicio = data_inicio ? data_inicio + ' 00:00:00' : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim ? data_fim + ' 23:59:59' : new Date().toISOString().split('T')[0] + ' 23:59:59';

    // Parâmetros base usados nas subqueries de somas financeiras
    let queryParams = [inicio, fim, inicio, fim];
    let filtroSetor = '';

    if (setor_id && setor_id !== 'todos') {
        filtroSetor = 'WHERE e.setor_id = ?';
        queryParams.push(setor_id);
    }

    // CORREÇÃO: Alterado 'equipment_id' para 'equipamento_id' nas duas subqueries abaixo
    const query = `
        SELECT
            e.id, 
            e.nome, 
            e.modelo, 
            e.patrimonio, 
            e.fabricante as marca, 
            e.status,
            IFNULL(s.nome, 'Sem Setor') as setor_nome,
            IFNULL(t.nome, 'Sem Tipo') as tipo_nome,
            (
                SELECT IFNULL(SUM(c.custo_servico), 0) 
                FROM chamados c 
                WHERE c.equipamento_id = e.id AND c.data_abertura BETWEEN ? AND ?
            ) +
            (
                SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0)
                FROM chamados_itens ci
                JOIN chamados ch ON ci.chamado_id = ch.id
                WHERE ch.equipamento_id = e.id AND ch.data_abertura BETWEEN ? AND ?
            ) as total_gasto
        FROM equipamentos e
        LEFT JOIN setores s ON e.setor_id = s.id
        LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id
        ${filtroSetor}
        ORDER BY total_gasto DESC, s.nome ASC, e.nome ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Erro ao gerar inventário avançado:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results || []);
    });
});

app.get('/api/relatorios/custos-setor', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { data_inicio, data_fim, setor_id } = req.query;

    const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim || new Date().toISOString().split('T')[0] + ' 23:59:59';

    let queryParams = [inicio, fim];
    let filtroSetor = '';

    if (setor_id && setor_id !== 'todos') {
        filtroSetor = 'AND s.id = ?';
        queryParams.push(setor_id);
    }

    const sql = `
        SELECT 
            s.id AS setor_id,
            s.nome AS nome_setor,
            COUNT(c.id) AS total_chamados,
            SUM(COALESCE(c.custo_servico, 0)) AS total_custo_servico,
            SUM(COALESCE(ci.total_pecas, 0)) AS total_custo_pecas,
            (SUM(COALESCE(c.custo_servico, 0)) + SUM(COALESCE(ci.total_pecas, 0))) AS custo_total_geral
        FROM setores s
        LEFT JOIN chamados c ON c.setor_id = s.id AND c.data_abertura BETWEEN ? AND ?
        LEFT JOIN (
            SELECT chamado_id, SUM(quantidade * valor_unitario_na_epoca) AS total_pecas
            FROM chamados_itens
            GROUP BY chamado_id
        ) ci ON ci.chamado_id = c.id
        WHERE 1=1 ${filtroSetor}
        GROUP BY s.id, s.nome
        ORDER BY custo_total_geral DESC
    `;

    db.query(sql, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Erro ao gerar relatório por setor:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

// -------------------------------------------------------------------------
// LOGÍSTICA / AUXILIARES
// -------------------------------------------------------------------------
app.get('/api/setores', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `SELECT s1.id, TRIM(LEADING ' > ' FROM CONCAT_WS(' > ', s3.nome, s2.nome, s1.nome)) as nome
                    FROM setores s1 LEFT JOIN setores s2 ON s1.setor_pai_id = s2.id LEFT JOIN setores s3 ON s2.setor_pai_id = s3.id
                    ORDER BY s3.nome, s2.nome, s1.nome ASC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/setores', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome, setor_pai_id } = req.body;
    
    if (!nome || nome.trim() === "") {
        return res.status(400).json({ error: "O nome do setor é obrigatório." });
    }

    const v_setor_pai = setor_pai_id && setor_pai_id !== "" ? Number(setor_pai_id) : null;
    const query = `INSERT INTO setores (nome, setor_pai_id) VALUES (?, ?)`;
    
    db.query(query, [nome.trim(), v_setor_pai], (err, result) => {
        if (err) {
            console.error("❌ Erro ao cadastrar setor:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Setor cadastrado com sucesso!", id: result.insertId });
    });
});

app.get('/api/types_equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query(`SELECT * FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// ALMOXARIFADO / ESTOQUE
app.get('/api/estoque', permitirApenas(['admin', 'coordenador']), (req, res) => {
    db.query("SELECT id, nome, referencia, descricao, quantidade, valor_unitario FROM itens_estoque WHERE quantidade > 0 ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/estoque', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome, descricao, quantidade, valor_unitario, num_nota, referencia } = req.body;
    
    const qtd = Number(quantidade) || 0;
    const valor = Number(valor_unitario) || 0.00;
    const ref_limpa = referencia && referencia.trim() !== "" ? referencia : null;

    db.beginTransaction((err, conn) => {
        if (err) {
            console.error("Erro ao iniciar transação:", err);
            return res.status(500).json({ error: err.message });
        }

        const queryItem = `
            INSERT INTO itens_estoque (nome, referencia, descricao, quantidade, valor_unitario, data_cadastro, data_atualizacao) 
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        conn.query(queryItem, [nome, ref_limpa, descricao || null, qtd, valor], (errItem, resultItem) => {
            if (errItem) {
                console.error("❌ Erro ao inserir na tabela principal:", errItem.message);
                return conn.rollback(() => { conn.release(); res.status(500).json({ error: errItem.message }); });
            }

            const novoItemId = resultItem.insertId;
            const queryHistorico = `
                INSERT INTO itens_estoque_entradas (item_id, quantidade, valor_unitario, num_nota, data_entrada)
                VALUES (?, ?, ?, ?, NOW())
            `;

            conn.query(queryHistorico, [novoItemId, qtd, valor, num_nota || null], (errHist) => {
                if (errHist) {
                    console.error("❌ Erro ao gravar histórico de entrada:", errHist.message);
                    return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });
                }

                conn.commit((errCommit) => {
                    if (errCommit) {
                        console.error("Erro no commit da transação:", errCommit.message);
                        return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    }
                    conn.release();
                    res.status(201).json({ message: "Item e histórico registrados com sucesso!", id: novoItemId });
                });
            });
        });
    });
});

// FORNECEDORES
app.get('/api/fornecedores', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const query = "SELECT id, nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status FROM fornecedores ORDER BY nome_fantasia ASC";
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

app.post('/api/fornecedores', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade } = req.body;
    const query = "INSERT INTO fornecedores (nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativo')";
    const values = [nome_fantasia, razao_social || null, cnpj || null, contato || null, telefone || null, email || null, especialidade || null];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor cadastrado com sucesso!", id: result.insertId });
    });
});

app.put('/api/fornecedores/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status } = req.body;
    const query = "UPDATE fornecedores SET nome_fantasia=?, razao_social=?, cnpj=?, contato=?, telefone=?, email=?, especialidade=?, status=? WHERE id=?";
    const values = [nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status, id];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor atualizado com sucesso!" });
    });
});

app.delete('/api/fornecedores/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM fornecedores WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor removido com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE CONTROLE DE FILTROS DE ÁGUA
// -------------------------------------------------------------------------
app.get('/api/filtros', permitirApenas(['admin']), (req, res) => {
    const query = `
        SELECT f.id, f.nome, f.setor_id, f.modelo_refil, f.data_ultima_troca, f.periodicidade_meses, f.observacoes,
               s.nome as setor_nome,
               DATE_ADD(f.data_ultima_troca, INTERVAL COALESCE(f.periodicidade_meses, 3) MONTH) as data_vencimento,
               DATEDIFF(DATE_ADD(f.data_ultima_troca, INTERVAL COALESCE(f.periodicidade_meses, 3) MONTH), CURDATE()) as dias_restantes
        FROM filtros_agua f
        LEFT JOIN setores s ON f.setor_id = s.id
        ORDER BY data_vencimento ASC
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error("❌ Erro ao listar filtros de água:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(result || []);
    });
});

app.post('/api/filtros', permitirApenas(['admin']), (req, res) => {
    const { nome, setor_id, modelo_refil, data_ultima_troca, periodicidade_meses, observacoes } = req.body;
    
    const v_setor = setor_id ? Number(setor_id) : null;
    const v_periodo = periodicidade_meses ? Number(periodicidade_meses) : 3;
    const v_data = data_ultima_troca || new Date().toISOString().split('T')[0];

    const query = `INSERT INTO filtros_agua (nome, setor_id, modelo_refil, data_ultima_troca, periodicidade_meses, observacoes) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(query, [nome, v_setor, modelo_refil || null, v_data, v_periodo, observacoes || null], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Filtro cadastrado!", id: result.insertId });
    });
});

app.post('/api/filtros/baixa', permitirApenas(['admin']), (req, res) => {
    const { filtro_id, tecnico_nome, obs_intervencao, item_id, quantidade } = req.body;
    const qtd_usada = Number(quantidade) || 0;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Atualiza a data da última troca na tabela filtros_agua
        const queryUpdate = `UPDATE filtros_agua SET data_ultima_troca = CURDATE() WHERE id = ?`;
        conn.query(queryUpdate, [filtro_id], (errUp) => {
            if (errUp) return conn.rollback(() => { res.status(500).json({ error: errUp.message }); });

            if (item_id && qtd_usada > 0) {
                // 2. Busca o valor unitário do item no estoque
                conn.query("SELECT nome, quantidade, valor_unitario FROM itens_estoque WHERE id = ?", [item_id], (errEstoque, results) => {
                    if (errEstoque || results.length === 0) {
                        return conn.rollback(() => { res.status(400).json({ error: "Item de refil não localizado no almoxarifado." }); });
                    }

                    const item = results[0];
                    if (item.quantidade < qtd_usada) {
                        return conn.rollback(() => { res.status(400).json({ error: `Estoque insuficiente! Saldo atual: ${item.quantidade} un.` }); });
                    }

                    const custo_total = item.valor_unitario * qtd_usada;
                    // String de histórico com formato clássico para a tabela do relatório ler as peças
                    const log_intervencao = `${obs_intervencao || 'Troca de refil.'} [Peça Deduzida: ${qtd_usada}x ${item.nome} | Custo Médio: R$ ${custo_total.toFixed(2)}]`;

                    // 3. Atualiza o custo acumulado numérico do ponto de filtragem
                    const queryUpdateFiltro = `
                        UPDATE filtros_agua 
                        SET custo_acumulado = custo_acumulado + ?
                        WHERE id = ?`;

                    conn.query(queryUpdateFiltro, [custo_total, filtro_id], (errCusto) => {
                        if (errCusto) return conn.rollback(() => { res.status(500).json({ error: errCusto.message }); });

                        // 4. Grava no histórico tradicional do módulo
                        const queryHist = `INSERT INTO filtros_historico (filtro_id, data_troca, tecnico_nome, obs_intervencao) VALUES (?, CURDATE(), ?, ?)`;
                        conn.query(queryHist, [filtro_id, tecnico_nome || 'Técnico', log_intervencao], (errHist) => {
                            if (errHist) return conn.rollback(() => { res.status(500).json({ error: errHist.message }); });

                            // 5. Deduz a quantidade física do estoque do almoxarifado
                            conn.query("UPDATE itens_estoque SET quantidade = quantidade - ? WHERE id = ?", [qtd_usada, item_id], (errDeduz) => {
                                if (errDeduz) return conn.rollback(() => { res.status(500).json({ error: errDeduz.message }); });

                                conn.commit((errCommit) => {
                                    if (errCommit) return conn.rollback(() => { res.status(500).json({ error: errCommit.message }); });
                                    res.json({ message: "Refil trocado, estoque deduzido e custo processado com sucesso! 🚰✅" });
                                });
                            });
                        });
                    });
                });
            } else {
                // Caso seja uma troca manual sem deduzir insumos do estoque
                const queryHist = `INSERT INTO filtros_historico (filtro_id, data_troca, tecnico_nome, obs_intervencao) VALUES (?, CURDATE(), ?, ?)`;
                conn.query(queryHist, [filtro_id, tecnico_nome || 'Técnico', obs_intervencao || 'Troca manual sem peça do estoque'], (errHist) => {
                    if (errHist) return conn.rollback(() => { res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { res.status(500).json({ error: errCommit.message }); });
                        res.json({ message: "Troca registrada com sucesso!" });
                    });
                });
            }
        });
    });
});

app.get('/api/filtros/relatorio', permitirApenas(['admin']), (req, res) => {
    const { data_inicio, data_fim } = req.query;
    const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fim = data_fim || new Date().toISOString().split('T')[0];

    const query = `
        SELECT h.id, h.data_troca, h.tecnico_nome, h.obs_intervencao, f.nome AS filtro_nome, s.nome AS setor_nome
        FROM filtros_historico h
        JOIN filtros_agua f ON h.filtro_id = f.id
        LEFT JOIN setores s ON f.setor_id = s.id
        WHERE h.data_troca BETWEEN ? AND ?
        ORDER BY h.data_troca DESC
    `;

    db.query(query, [inicio, fim], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let totalFiltrosTrocados = results.length;
        let custoTotalPeriodo = 0;

        // 🟢 Varre as linhas procurando o padrão de texto de forma resiliente (aceita ou não espaços)
        results.forEach(row => {
            if (row.obs_intervencao && row.obs_intervencao.includes('Custo Médio: R$')) {
                try {
                    const partes = row.obs_intervencao.split('Custo Médio: R$');
                    if (partes[1]) {
                        const valorLimpo = partes[1].replace(']', '').trim();
                        custoTotalPeriodo += parseFloat(valorLimpo) || 0;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        });

        res.json({
            periodo: { inicio, fim },
            indicators: { 
                total_trocas: totalFiltrosTrocados, 
                custo_total: Number(custoTotalPeriodo) || 0 
            },
            detalhes: results
        });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));