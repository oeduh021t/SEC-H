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

const filtroDocumentos = (req, file, cb) => {
    const extensoesPermitidas = /jpeg|jpg|png|pdf/;
    const extname = extensoesPermitidas.test(path.extname(file.originalname).toLowerCase());
    const mimetype = extensoesPermitidas.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Erro: O sistema aceita apenas arquivos in formato PDF ou Imagem (JPEG, JPG, PNG)!'));
    }
};

// Instância do multer específica para documentos
const uploadDocumento = multer({
    storage: storage, // Reaproveita o seu diskStorage que gera nomes únicos
    fileFilter: filtroDocumentos,
    limits: { fileSize: 15 * 1024 * 1024 } // Limite de 15MB para PDFs maiores
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
    timezone: '-03:00',
    dateStrings: true,
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


// TESTE HORA

app.get('/api/testar-horario', (req, res) => {
    const horaNode = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaNodeUTC = new Date().toISOString();

    db.query("SELECT NOW() AS hora_banco, NOW() - INTERVAL 0 HOUR AS data_hora_banco", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({
            horario_servidor_node: horaNode,
            horario_utc_node: horaNodeUTC,
            horario_banco_mysql: result[0].hora_banco
        });
    });
});




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
            AND DATE_ADD(data_ultima_preventiva, INTERVAL periodicidade_preventiva DAY) 
                BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 15 DAY)`,
        
        porEquipamento: `
            SELECT e.nome, COUNT(c.id) as total
            FROM chamados c 
            JOIN equipamentos e ON c.equipamento_id = e.id
            GROUP BY e.id 
            ORDER BY total DESC 
            LIMIT 5`,

        porTecnico: `
            SELECT tecnico_responsavel as nome, COUNT(*) as total
            FROM chamados WHERE tecnico_responsavel IS NOT NULL AND tecnico_responsavel != ''
            GROUP BY tecnico_responsavel ORDER BY total DESC`,
        recentes: "SELECT id, titulo, status, data_abertura FROM chamados ORDER BY id DESC LIMIT 6",

        // 1. Gasto total com Filtros (Fazendo JOIN correto com itens_estoque)
        gastoFiltros: `
           SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0) as total 
           FROM chamados_itens ci
           JOIN itens_estoque i ON ci.item_id = i.id
           WHERE i.tipo = 'Filtro'`,

        // 2. Gasto com Insumos Gerais (Tudo que não contiver a palavra Filtro)
        gastoInsumosGerais: `
            SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0) as total 
            FROM chamados_itens ci
            JOIN itens_estoque i ON ci.item_id = i.id
            WHERE i.tipo != 'Filtro'`,

        // 3. Gasto Total em Equipamentos (Soma de peças utilizadas + custos de serviço de chamados vinculados a equipamentos + VALOR DE AQUISIÇÃO DOS EQUIPAMENTOS)
        gastoTotalEquipamentos: `
            SELECT (
                SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0)
                FROM chamados_itens ci
                JOIN chamados c ON ci.chamado_id = c.id
                WHERE c.equipamento_id IS NOT NULL
            ) + (
                SELECT IFNULL(SUM(custo_servico), 0)
                FROM chamados
                WHERE equipamento_id IS NOT NULL
            ) + (
                SELECT IFNULL(SUM(valor), 0)
                FROM equipamentos
            ) as total`,

        // 4. 🛠️ CORRIGIDOConceitualmente: Gasto Total em Estrutura (Soma peças + serviços terceirizados onde NÃO há equipamento atrelado)
        gastoTotalEstrutura: `
            SELECT (
                SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0)
                FROM chamados_itens ci
                JOIN chamados c ON ci.chamado_id = c.id
                WHERE c.equipamento_id IS NULL
            ) + (
                SELECT IFNULL(SUM(custo_servico), 0)
                FROM chamados
                WHERE equipamento_id IS NULL
            ) as total`,

        // Boletos que vencem hoje e estão abertos
        boletosVencendoHoje: `
            SELECT COUNT(*) as total FROM boletos 
            WHERE data_vencimento = CURDATE() AND status_pagamento != 'Pago'`,

        // Boletos que já passaram do vencimento e não foram pagos
        boletosAtrasados: `
            SELECT COUNT(*) as total FROM boletos 
            WHERE data_vencimento < CURDATE() AND status_pagamento != 'Pago'`,

        // Fluxo de caixa de boletos previstos para os próximos 7 dias
        boletosVencendoSemana: `
            SELECT COUNT(*) as total FROM boletos 
            WHERE data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) 
            AND status_pagamento != 'Pago'`
    };

    const promises = Object.keys(queries).map(key => {
        return new Promise((resolve) => {
            db.query(queries[key], (err, results) => {
                if (err) {
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
                if (['gastoFiltros', 'gastoInsumosGerais', 'gastoTotalEquipamentos', 'gastoTotalEstrutura', 'boletosVencendoHoje', 'boletosAtrasados', 'boletosVencendoSemana'].includes(r.key)) {
                    stats[r.key] = r.data[0]?.total || 0;
                } else {
                    stats[r.key] = r.data; 
                }
            });
            res.json(stats);
        })
        .catch(err => {
            const finalErr = err || { message: 'Erro desconhecido' };
            console.error("❌ Falha crítica no Promise.all da Dashboard:", finalErr.message);
            res.status(500).json({ error: finalErr.message });
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
        // 🛠️ CORRIGIDO: Alterado de 'text: message' para 'text: mensagem'
        await axios.post(url, { chat_id, text: mensagem, parse_mode: 'Markdown' });
        console.log("✅ Notificação enviada ao Telegram");
    } catch (err) {
        const finalErr = err || { message: 'Erro desconhecido' };
        console.error("❌ Erro ao enviar Telegram:", finalErr.message);
    }
};

// -------------------------------------------------------------------------
// ROTAS DE EQUIPAMENTOS - CORRIGIDAS PARA SALVAR PREVENTIVAS E COLUNAS DO BANCO
// -------------------------------------------------------------------------
app.get('/api/equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id ORDER BY e.id DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// 🟢 NOVO ATIVO: Captura a "data_ultima_preventiva" e grava no "tipo_equipamento_id"
app.post('/api/equipamentos', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva, local_estoque_id, valor } = req.body;
    
    // Captura o arquivo de foto se ele foi enviado
    const foto_equipamento = req.file ? `/uploads/${req.file.filename}` : null;

    // Sanitização de tipos contra valores vazios
    const v_nome = nome && nome.trim() !== "" ? nome : 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio.trim() : null;
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    
    // Grava o ID recebido nas duas colunas para garantir sincronia do banco legado
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;
    const v_valor = valor && valor !== "" ? Number(valor) : 0.00; // 🆕 Higienização do valor

    // Se o usuário não enviou uma data, define como null para não dar erro de data inválida
    const v_data_preventiva = data_ultima_preventiva && data_ultima_preventiva.trim() !== "" ? data_ultima_preventiva : null;

    // Query atualizada gravando tanto em tipo_id quanto em tipo_equipamento_id, além da data customizada e valor
    const query = `INSERT INTO equipamentos 
        (nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, tipo_equipamento_id, periodicidade_preventiva, data_ultima_preventiva, foto_equipamento, local_estoque_id, valor) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
    const values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_tipo_id, v_periodicidade, v_data_preventiva, foto_equipamento, v_local_estoque_id, v_valor];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro interno do MySQL no POST de equipamentos:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Sucesso!", id: result.insertId });
    });
});

// 🟡 EDITAR ATIVO: Adicionado suporte à atualização da "data_ultima_preventiva" e "tipo_equipamento_id"
app.put('/api/equipamentos/:id', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { id } = req.params;
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva, local_estoque_id, valor } = req.body;
    
    const v_nome = nome || 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio.trim() : null;
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    
    // Alinha o tipo nas duas colunas
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;
    const v_valor = valor && valor !== "" ? Number(valor) : 0.00; // 🆕 Higienização do valor
    
    // Trata a data vinda da edição
    const v_data_preventiva = data_ultima_preventiva && data_ultima_preventiva.trim() !== "" ? data_ultima_preventiva : null;

    let query, values;

    if (req.file) {
        const foto_equipamento = `/uploads/${req.file.filename}`;
        query = `UPDATE equipamentos SET nome=?, modelo=?, patrimonio=?, num_serie=?, fabricante=?, setor_id=?, status=?, tipo_id=?, tipo_equipamento_id=?, periodicidade_preventiva=?, data_ultima_preventiva=?, foto_equipamento=?, local_estoque_id=?, valor=? WHERE id=?`;
        values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_tipo_id, v_periodicidade, v_data_preventiva, foto_equipamento, v_local_estoque_id, v_valor, id];
    } else {
        query = `UPDATE equipamentos SET nome=?, modelo=?, patrimonio=?, num_serie=?, fabricante=?, setor_id=?, status=?, tipo_id=?, tipo_equipamento_id=?, periodicidade_preventiva=?, data_ultima_preventiva=?, local_estoque_id=?, valor=? WHERE id=?`;
        values = [v_nome, v_modelo, v_patrimonio, v_num_serie, v_fabricante, v_setor_id, v_status, v_tipo_id, v_tipo_id, v_periodicidade, v_data_preventiva, v_local_estoque_id, v_valor, id];
    }

    db.query(query, values, (err) => {
        if (err) {
            console.error("❌ Erro interno do MySQL no PUT de equipamentos:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Dados updates com sucesso!" });
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

    const categoryFinal = categoria || category || 'Manutenção';

    // 🟢 Tratamento contra strings nulas vindas do FormData no redirecionamento do Prontuário
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" && setor_id !== "undefined" ? Number(setor_id) : null;
    const v_equipamento_id = equipamento_id && equipamento_id !== "" && equipamento_id !== "null" && equipamento_id !== "undefined" ? Number(equipamento_id) : null;

    // 🛠️ CORRIGIDO: Removida a coluna espelhada 'category' para focar apenas em 'categoria' (Alinha 8 campos com 8 interrogações)
    const query = `INSERT INTO chamados (setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao, foto_abertura, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [v_setor_id, v_equipamento_id, titulo, descricao_problema, prioridade || 'Média', categoryFinal, tipo_manutencao || 'Corretiva', foto_abertura];

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
    const { 
        status, 
        tipo_atendimento, 
        descricao_solucao, 
        fornecedor_id, 
        nf_referencia, 
        custo_servico, 
        tecnico_responsavel, 
        tecnico_id // 🆕 Recebendo o ID do técnico escolhido
    } = req.body;
    
    const tecnico_nome = tecnico_responsavel || "Técnico do Sistema";
    const v_tecnico_id = tecnico_id && tecnico_id !== "" ? Number(tecnico_id) : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        // 🆕 Query updated para persistir o 'tecnico_id'
        const queryUpdate = `
            UPDATE chamados
            SET status = ?, 
                tipo_atendimento = ?, 
                tecnico_responsavel = ?, 
                tecnico_id = ?, 
                fornecedor_id = ?, 
                nf_referencia = ?, 
                custo_servico = ?,
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;
        const valuesUpdate = [
            status, 
            tipo_atendimento, 
            tecnico_nome, 
            v_tecnico_id, // 🆕 Vinculando a chave estrangeira
            fornecedor_id || null, 
            nf_referencia || null, 
            custo_servico || 0, 
            status, 
            id
        ];

        conn.query(queryUpdate, valuesUpdate, (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: err.message }); });

            if (descricao_solucao && descricao_solucao.trim() !== "") {
                const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
                conn.query(queryHist, [id, tecnico_nome, descricao_solucao, status], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Chamado e cronologia updated com sucesso!" });
                    });
                });
            } else {
                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.json({ message: "Chamado atualizado com sucesso!" });
                });
            }
        });
    });
});

// 🟢 CORRIGIDO: Correção do erro de digitação de "quantity" para "quantidade" no UPDATE do estoque
app.post('/api/chamados/:id/itens', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { item_id, quantity, quantidade } = req.body;

    const qtd_solicitada = Number(quantidade || quantity || 0);

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

                    // 🛠️ CORREÇÃO AQUI: Mudado de quantity para quantidade
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

        // 🟢 CORRIGIDO: Agora atualiza explicitamente o campo 'descricao_solucao' na tabela principal 'chamados' ao concluir
        const queryUpdate = `
            UPDATE chamados
            SET status = ?, 
                tecnico_responsavel = ?, 
                descricao_solucao = ?, 
                tipo_atendimento = ?,
                foto_conclusao = COALESCE(?, foto_conclusao),
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;
        const valuesUpdate = [status, tecnico_responsavel, descricao_solucao, tipo_atendimento, foto_conclusao, status, id];

        conn.query(queryUpdate, valuesUpdate, (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });

            const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
            const msgHist = descricao_solucao || `Status alterado para ${status}`;

            conn.query(queryHist, [id, tecnico_responsavel, msgHist, status], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).json(err); });
                
                conn.commit(errCommit => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json(errCommit); });
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
// ROTAS DE PREVENTIVAS (VERSÃO ULTRA-ESTÁVEL - ZERO SUBQUERIES)
// -------------------------------------------------------------------------
app.get('/api/preventivas', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT 
            e.id, 
            e.nome, 
            e.patrimonio, 
            e.setor_id, 
            s.nome as setor_nome,
            e.data_ultima_preventiva, 
            e.periodicidade_preventiva,
            IFNULL(t.nome, 'Aparelho') as tipo_nome,
            e.tipo_id,
            -- Calcula a data exata do próximo vencimento baseado no ciclo real do ativo
            DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY) as data_vencimento,
            -- Calcula a diferença de dias exata até a data de vencimento projetada
            DATEDIFF(DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY), CURDATE()) as dias_restantes
        FROM equipamentos e
        LEFT JOIN setores s ON e.setor_id = s.id
        LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id
        WHERE (e.status IN ('Ativo', 'Em Manutenção', 'Reserva'))
          AND e.periodicidade_preventiva > 0 -- 🛠️ Correção: Ignora ativos que não possuem plano de preventiva/PMOC
        ORDER BY dias_restantes ASC
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error("❌ Erro fatal na query de preventivas:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(result || []);
    });
});

app.post('/api/preventivas/baixa', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('arquivo'), (req, res) => {
    const { equipamento_id, relatorio_tecnico, tecnico_nome } = req.body;
    
    // Captura o caminho do arquivo se ele foi enviado
    const url_anexo = req.file ? `/uploads/${req.file.filename}` : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json(err);
        
        // 1. Atualiza a data da última preventiva para HOJE
        conn.query("UPDATE equipamentos SET data_ultima_preventiva = CURDATE() WHERE id = ?", [equipamento_id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json(errUp); });
            
            // 2. Insere na cronologia salvando a url do anexo na coluna 'arquivo_url'
            const historicoTexto = `[ID EQUIP: ${equipamento_id}] RELATÓRIO DE PREVENTIVA: ${relatorio_tecnico}`;
            const queryHist = `
                INSERT INTO chamados_historico 
                (chamado_id, tecnico_nome, texto_historico, status_momento, arquivo_url, data_registro) 
                VALUES (NULL, ?, ?, 'Preventiva Realizada', ?, NOW())
            `;
            
            conn.query(queryHist, [tecnico_nome || 'Técnico', historicoTexto, url_anexo], (errHist) => {
                if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json(errHist); });
                
                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json(errCommit); });
                    conn.release();
                    res.json({ message: "Baixa de preventiva registrada com sucesso!" });
                });
            });
        });
    });
});

// 🛠️ VERSÃO DEFINITIVA: Prontuário ajustado para ler 'arquivo_url' do histórico e somar o valor patrimonial inicial
app.get('/api/equipamentos/:id/prontuario', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const queryEquip = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id WHERE e.id = ?`;
    
    const queryTimeline = `
        (
            SELECT 
                c.data_abertura as data, 
                c.titulo as evento, 
                'Abertura OS' as tipo, 
                'Usuário' as responsavel, 
                c.status, 
                c.id as ref_id, 
                NULL as url_anexo 
            FROM chamados c 
            WHERE c.equipamento_id = ?
        )
        UNION
        (
            SELECT 
                h.data_registro as data, 
                h.texto_historico as evento, 
                'Intervenção Técnica' as tipo, 
                h.tecnico_nome as responsavel, 
                h.status_momento as status, 
                c.id as ref_id, 
                COALESCE(d.url_arquivo, h.arquivo_url) as url_anexo
            FROM chamados_historico h 
            JOIN chamados c ON h.chamado_id = c.id 
            -- 🟢 AJUSTE AQUI: Faz um JOIN com a tabela de documentos usando o nome do arquivo para obter a url real
            LEFT JOIN documentos d ON d.chamado_id = c.id AND h.texto_historico LIKE CONCAT('%', d.nome_original, '%')
            WHERE c.equipamento_id = ?
        )
        UNION
        (
            SELECT 
                data_registro as data, 
                texto_historico as evento, 
                'Preventiva' as tipo, 
                tecnico_nome as responsavel, 
                status_momento as status, 
                0 as ref_id, 
                arquivo_url as url_anexo
            FROM chamados_historico 
            WHERE texto_historico LIKE CONCAT('%[ID EQUIP: ', ?, ']%')
        )
        UNION
        (
            SELECT 
                data_movimentacao as data, 
                descricao_log as evento, 
                'Movimentação' as tipo, 
                tecnico_nome as responsavel, 
                status_novo as status, 
                0 as ref_id, 
                NULL as url_anexo
            FROM equipamentos_historico 
            WHERE equipamento_id = ?
        )
        ORDER BY data DESC
    `;

    db.query(queryEquip, [id], (err, equip) => {
        if (err) return res.status(500).json(err);
        if (equip.length === 0) return res.status(404).json({ message: "Não encontrado" });
        
        db.query(queryTimeline, [id, id, id, id], (errTimeline, timeline) => {
            if (errTimeline) return res.status(500).json(errTimeline);
            
            // 🛠️ ATUALIZADO: Query modificada para somar o valor inicial de aquisição do ativo (e.valor)
            const queryCusto = `
                SELECT (SELECT IFNULL(SUM(custo_servico), 0) FROM chamados WHERE equipamento_id = ? AND status = 'Concluído') +
                        (SELECT IFNULL(SUM(quantidade * valor_unitario_na_epoca), 0) FROM chamados_itens ci JOIN chamados c ON ci.chamado_id = c.id WHERE c.equipamento_id = ?) +
                        (SELECT IFNULL(valor, 0) FROM equipamentos WHERE id = ?)
                as total`;
                
            db.query(queryCusto, [id, id, id], (errCusto, custo) => {
                if (errCusto) return res.status(500).json(errCusto);
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

// GET: Listar apenas usuários habilitados para atendimento (técnicos, admins e coordenadores)
app.get('/api/tecnicos', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `
        SELECT id, nome 
        FROM usuarios 
        WHERE nivel IN ('tecnico', 'admin', 'coordenador') 
        ORDER BY nome ASC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// -------------------------------------------------------------------------
// RELATÓRIOS GERAIS
// -------------------------------------------------------------------------
// OBTENER RELATÓRIO DETALHADO UNIFICADO COM FILTRO DE TIPO DE REGISTRO
app.get('/api/relatorios/estoque-local', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { local_estoque_id, data_inicio, data_fim, tipo_registro } = req.query;

    let query = `
        SELECT * FROM (
            -- 1. Bloco de Insumos / Peças
            SELECT 
                i.id, 
                i.nome, 
                IFNULL(i.referencia, '---') AS referencia, 
                i.quantidade, 
                i.valor_unitario, 
                IFNULL(i.data_cadastro, NOW()) AS data_cadastro,
                'Insumo' AS tipo_registro, 
                i.local_estoque_id, 
                l.nome AS nome_estoque, 
                IFNULL(i.descricao, 'Sem descrição informada') AS descricao
            FROM itens_estoque i
            JOIN locais_estoque l ON i.local_estoque_id = l.id
            
            UNION ALL
            
            -- 2. Bloco de Equipamentos (Ajustado para usar CURDATE() e fallbacks compatíveis)
            SELECT 
                e.id, 
                CONCAT(e.nome, ' (S/N: ', IFNULL(e.num_serie, 'N/A'), ')') AS nome,
                IFNULL(e.patrimonio, 'S/Patrimônio') AS referencia, 
                1 AS quantidade, 
                0.00 AS valor_unitario, 
                IFNULL(e.data_ultima_preventiva, CURDATE()) AS data_cadastro, -- Fallback para evitar erro de coluna
                'Equipamento' AS tipo_registro, 
                e.local_estoque_id, 
                l.nome AS nome_estoque, 
                CONCAT('Modelo: ', IFNULL(e.modelo, 'Não informado'), ' | Fabricante: ', IFNULL(e.fabricante, 'Não informado')) AS descricao
            FROM equipamentos e
            JOIN locais_estoque l ON e.local_estoque_id = l.id
        ) AS tabela_consolidada
        WHERE 1=1
    `;
    const queryParams = [];

    // Filtro por Local de Estoque
    if (local_estoque_id && local_estoque_id !== 'todos') {
        query += ` AND local_estoque_id = ?`;
        queryParams.push(Number(local_estoque_id));
    }

    // Filtro por tipo (Equipamento ou Insumo)
    if (tipo_registro && tipo_registro !== 'todos') {
        query += ` AND tipo_registro = ?`;
        queryParams.push(tipo_registro);
    }

    // Filtro por Período
    if (data_inicio && data_fim) {
        query += ` AND data_cadastro BETWEEN ? AND ?`;
        queryParams.push(`${data_inicio} 00:00:00`, `${data_fim} 23:59:59`);
    }

    query += ` ORDER BY nome_estoque ASC, tipo_registro DESC, nome ASC`;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Erro ao gerar relatório consolidado:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result || []);
    });
});


// ⚙️ ROTA ATUALIZADA COM FILTRAGEM DINÂMICA DE STATUS (CORREÇÃO DE BUG)
app.get('/api/relatorios/inventario-geral', permitirApenas(['admin', 'coordenador']), (req, res) => {
    // 🆕 Adicionado 'status' na desestruturação de query params
    const { data_inicio, data_fim, setor_id, status } = req.query;

    const inicio = data_inicio ? data_inicio + ' 00:00:00' : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim ? data_fim + ' 23:59:59' : new Date().toISOString().split('T')[0] + ' 23:59:59';

    // Parâmetros estruturados para as subqueries financeiras (período inicial e final do cálculo de custos)
    let queryParams = [inicio, fim, inicio, fim];
    let filtrosAdicionais = [];

    // Filtro Dinâmico de Setor
    if (setor_id && setor_id !== 'todos') {
        filtrosAdicionais.push('e.setor_id = ?');
        queryParams.push(setor_id);
    }

    // 🆕 Filtro Dinâmico de Status mapeado diretamente com o Enum da tabela 'equipamentos'
    if (status && status !== 'todos') {
        filtrosAdicionais.push('e.status = ?');
        queryParams.push(status);
    }

    // Monta a cláusula WHERE apenas se houver filtros aplicados além do período base
    const clausulaWhere = filtrosAdicionais.length > 0 
        ? `WHERE ${filtrosAdicionais.join(' AND ')}` 
        : '';

    // 🛠️ SINTAXE RESTAURADA: Removida interpolação direta com template string que quebrava o parser do MySQL. Força concatenação tradicional estável.
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
            ) + IFNULL(e.valor, 0) as total_gasto
        FROM equipamentos e
        LEFT JOIN setores s ON e.setor_id = s.id
        LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id
        ` + clausulaWhere + `
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
    let filterSetor = '';

    if (setor_id && setor_id !== 'todos') {
        filterSetor = 'AND s.id = ?';
        queryParams.push(setor_id);
    }

    // 🌳 SQL RECURSIVA: Monta o caminho completo do setor (Ex: Centro Médico > Térreo)
    const sql = `
        WITH RECURSIVE ArvoreSetores AS (
            SELECT id, setor_pai_id, nome, CAST(nome AS CHAR(1000)) as caminho
            FROM setores
            WHERE setor_pai_id IS NULL OR setor_pai_id = 0
            
            UNION ALL
            
            SELECT filho.id, filho.setor_pai_id, filho.nome, CONCAT(pai.caminho, ' > ', filho.nome)
            FROM setores filho
            INNER JOIN ArvoreSetores pai ON filho.setor_pai_id = pai.id
        )
        SELECT 
            s.id AS setor_id,
            s.caminho AS nome_setor, -- 👈 Agora retorna a árvore completa!
            COUNT(c.id) AS total_chamados,
            SUM(COALESCE(c.custo_servico, 0)) AS total_custo_servico,
            SUM(COALESCE(ci.total_pecas, 0)) AS total_custo_pecas,
            (SUM(COALESCE(c.custo_servico, 0)) + SUM(COALESCE(ci.total_pecas, 0))) AS custo_total_geral
        FROM ArvoreSetores s
        LEFT JOIN chamados c ON c.setor_id = s.id AND c.data_abertura BETWEEN ? AND ?
        LEFT JOIN (
            SELECT chamado_id, SUM(quantidade * valor_unitario_na_epoca) AS total_pecas
            FROM chamados_itens
            GROUP BY chamado_id
        ) ci ON ci.chamado_id = c.id
        WHERE 1=1 ${filterSetor}
        GROUP BY s.id, s.caminho
        ORDER BY custo_total_geral DESC, s.caminho ASC
    `;

    db.query(sql, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Erro ao gerar relatório por setor:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(result || []);
    });
});

// 🔍 DRILL-DOWN: Busca as OSs detalhadas de um setor específico no período
app.get('/api/relatorios/chamados-detalhes-setor', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { setor_id, data_inicio, data_fim } = req.query;

    if (!setor_id) {
        return res.status(400).json({ error: "Setor é obrigatório." });
    }

    const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim || new Date().toISOString().split('T')[0] + ' 23:59:59';

    const sql = `
        SELECT 
            c.id, 
            c.titulo, 
            c.status, 
            c.data_abertura, 
            c.tecnico_responsavel,
            e.nome AS equipamento_nome, 
            e.patrimonio AS equipamento_patrimonio,
            COALESCE(c.custo_servico, 0) AS custo_servico,
            COALESCE(ci.total_pecas, 0) AS custo_pecas,
            (COALESCE(c.custo_servico, 0) + COALESCE(ci.total_pecas, 0)) AS custo_total
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN (
            SELECT chamado_id, SUM(quantidade * valor_unitario_na_epoca) AS total_pecas
            FROM chamados_itens
            GROUP BY chamado_id
        ) ci ON ci.chamado_id = c.id
        WHERE c.setor_id = ? AND c.data_abertura BETWEEN ? AND ?
        ORDER BY c.data_abertura DESC
    `;

    db.query(sql, [Number(setor_id), inicio, fim], (err, results) => {
        if (err) {
            console.error("❌ Erro ao buscar detalhamento de OSs do setor:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results || []);
    });
});

// -------------------------------------------------------------------------
// LOGÍSTICA / AUXILIARES
// -------------------------------------------------------------------------
app.get('/api/setores', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        WITH RECURSIVE ArvoreSetores AS (
            -- Caso Base: Pega todos os setores e inicia a linha com o nome próprio
            SELECT id, setor_pai_id, nome, CAST(nome AS CHAR(1000)) as caminho
            FROM setores
            WHERE setor_pai_id IS NULL OR setor_pai_id = 0
            
            UNION ALL
            
            -- Passo Recursivo: Junta o setor pai ao filho indefinidamente até o topo
            SELECT filho.id, filho.setor_pai_id, filho.nome, CONCAT(pai.caminho, ' > ', filho.nome)
            FROM setores filho
            INNER JOIN ArvoreSetores pai ON filho.setor_pai_id = pai.id
        )
        SELECT id, caminho as nome
        FROM ArvoreSetores
        ORDER BY caminho ASC;
    `;
    
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

// 🔄 ROTA DE LISTAGEM ATUALIZADA: Mapeamento de endpoint unificado para o React (/api/tipos-equipamentos)
app.get('/api/tipos-equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query(`SELECT id, nome FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// 💡 ROTA LEGADA MANTIDA: Evita quebras ocultas em outras partes do sistema
app.get('/api/types_equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query(`SELECT * FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// 🆕 ROTA DE CADASTRO: Insere um novo tipo de ativo no banco de dados Express/MySQL
app.post('/api/tipos-equipamentos', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome } = req.body;
    if (!nome || nome.trim() === "") {
        return res.status(400).json({ error: "O nome da categoria/tipo é obrigatório." });
    }

    db.query(`INSERT INTO tipos_equipamentos (nome) VALUES (?)`, [nome.trim()], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Tipo cadastrado com sucesso!", insertId: result.insertId });
    });
});

// 🆕 ROTA DE EXCLUSÃO: Remove o tipo por ID com verificação de segurança integridade relacional
app.delete('/api/tipos-equipamentos/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;

    // 🛡️ Validação: Impede apagar o tipo se ele estiver em uso por algum equipamento ativo no SEC-H
    const queryCheck = `SELECT COUNT(*) as em_uso FROM equipamentos WHERE tipo_id = ? OR tipo_equipamento_id = ?`;
    
    db.query(queryCheck, [id, id], (errCheck, resultsCheck) => {
        if (errCheck) return res.status(500).json({ error: errCheck.message });
        
        if (resultsCheck[0].em_uso > 0) {
            return res.status(400).json({ 
                error: `Não é possível excluir! Existem ${resultsCheck[0].em_uso} equipamentos ativos utilizando este tipo no inventário.` 
            });
        }

        // Se passar na verificação, realiza o comando de exclusão física
        db.query(`DELETE FROM tipos_equipamentos WHERE id = ?`, [id], (errDel) => {
            if (errDel) return res.status(500).json({ error: errDel.message });
            res.json({ message: "Tipo de equipamento removido com sucesso!" });
        });
    });
});

// ALMOXARIFADO / ESTOQUE
app.get('/api/estoque', permitirApenas(['admin', 'coordenador']), (req, res) => {
    db.query("SELECT id, nome, referencia, descricao, quantidade, valor_unitario, local_estoque_id FROM itens_estoque WHERE quantidade > 0 ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/estoque', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome, descricao, quantidade, valor_unitario, num_nota, referencia, local_estoque_id } = req.body;
    
    const qtd = Number(quantidade) || 0;
    const valor = Number(valor_unitario) || 0.00;
    const ref_limpa = referencia && referencia.trim() !== "" ? referencia : null;
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;

    db.beginTransaction((err, conn) => {
        if (err) {
            console.error("Erro ao iniciar transação:", err);
            return res.status(500).json({ error: err.message });
        }

        const queryItem = `
            INSERT INTO itens_estoque (nome, referencia, descricao, quantidade, valor_unitario, data_cadastro, data_atualizacao, local_estoque_id) 
            VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
        `;
        
        conn.query(queryItem, [nome, ref_limpa, descricao || null, qtd, valor, v_local_estoque_id], (errItem, resultItem) => {
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

// -------------------------------------------------------------------------
// MÓDULO DE NOTAS FISCAIS E GESTÃO DE BOLETOS
// -------------------------------------------------------------------------

// 1. LISTAR TODAS AS NOTAS FISCAIS (Com dados do fornecedor associado)
app.get('/api/notas-fiscais', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const query = `
        SELECT nf.*, f.nome_fantasia as fornecedor_nome 
        FROM notas_fiscais nf
        JOIN fornecedores f ON nf.fornecedor_id = f.id
        ORDER BY nf.data_emissao DESC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// 2. CONSULTAR OS BOLETOS DE UMA NOTA FISCAL ESPECÍFICA
app.get('/api/notas-fiscais/:id/boletos', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const query = `SELECT * FROM boletos WHERE nota_fiscal_id = ? ORDER BY data_vencimento ASC`;
    
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// 3. CADASTRAR NOTA FISCAL COM ARQUIVOS (XML / DANFE)
app.post('/api/notas-fiscais', permitirApenas(['admin', 'coordenador']), uploadDocumento.fields([
    { name: 'xml', maxCount: 1 },
    { name: 'danfe', maxCount: 1 }
]), (req, res) => {
    const { numero_nf, serie, chave_acesso, fornecedor_id, data_emissao, data_recebimento, valor_total, descricao } = req.body;

    const url_xml = req.files['xml'] ? `/uploads/${req.files['xml'][0].filename}` : null;
    const url_danfe = req.files['danfe'] ? `/uploads/${req.files['danfe'][0].filename}` : null;

    const query = `
        INSERT INTO notas_fiscais (numero_nf, serie, chave_acesso, fornecedor_id, data_emissao, data_recebimento, valor_total, descricao, url_xml, url_danfe)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [numero_nf, serie || null, chave_acesso || null, Number(fornecedor_id), data_emissao, data_recebimento || null, Number(valor_total), descricao || null, url_xml, url_danfe];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro ao inserir nota fiscal:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Nota Fiscal cadastrada com sucesso!", id: result.insertId });
    });
});

// 4. CADASTRAR/ANEXAR UM BOLETO A UMA NOTA
app.post('/api/boletos', permitirApenas(['admin', 'coordenador']), uploadDocumento.single('boleto_pdf'), (req, res) => {
    const { nota_fiscal_id, parcela, codigo_barras, linha_digitavel, valor_boleto, data_vencimento } = req.body;
    const url_boleto_pdf = req.file ? `/uploads/${req.file.filename}` : null;

    const query = `
        INSERT INTO boletos (nota_fiscal_id, parcela, codigo_barras, linha_digitavel, valor_boleto, data_vencimento, url_boleto_pdf)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [Number(nota_fiscal_id), parcela || '1/1', codigo_barras || null, linha_digitavel || null, Number(valor_boleto), data_vencimento, url_boleto_pdf];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Boleto anexado com sucesso!", id: result.insertId });
    });
});

// 5. DAR BAIXA / REGISTRAR PAGAMENTO DO BOLETO (Com comprovante)
app.patch('/api/boletos/:id/pagar', permitirApenas(['admin', 'coordenador']), uploadDocumento.single('comprovante_pdf'), (req, res) => {
    const { id } = req.params;
    const { data_pagamento } = req.body;
    const url_comprovante_pdf = req.file ? `/uploads/${req.file.filename}` : null;

    const query = `
        UPDATE boletos 
        SET status_pagamento = 'Pago', data_pagamento = ?, url_comprovante_pdf = COALESCE(?, url_comprovante_pdf)
        WHERE id = ?
    `;

    db.query(query, [data_pagamento || new Date().toISOString().split('T')[0], url_comprovante_pdf, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Baixa de boleto processada com sucesso! 💰✅" });
    });
});

// 6. EXCLUIR NOTA FISCAL (Vai deletar os boletos automaticamente devido ao ON DELETE CASCADE)
app.delete('/api/notas-fiscais/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query(`DELETE FROM notas_fiscais WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Nota Fiscal e seus boletos associados foram deletados!" });
    });
});

// -------------------------------------------------------------------------
// GESTÃO DINÂMICA DE LOCAIS DE ESTOQUE / ÁREAS (ESCOPOS DE ATUAÇÃO)
// -------------------------------------------------------------------------

// 1. LISTAR LOCAIS DE ESTOQUE
app.get('/api/locais-estoque', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query("SELECT * FROM locais_estoque WHERE status = 'Ativo' ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// 2. CADASTRAR NOVO LOCAL DE ESTOQUE
app.post('/api/locais-estoque', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { nome, descricao } = req.body;
    if (!nome || nome.trim() === "") {
        return res.status(400).json({ error: "O nome do local de estoque é obrigatório." });
    }

    const query = "INSERT INTO locais_estoque (nome, descricao) VALUES (?, ?)";
    db.query(query, [nome.trim(), descricao || null], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Local de estoque criado com sucesso!", id: result.insertId });
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
        res.json({ message: "Fornecedor actualizado com sucesso!" });
    });
});

// DELETE FORNECEDOR
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

// 1. LISTAR PONTOS DE FILTRAGEM (Com dados do Setor e Equipamento/Bebedouro vinculado)
app.get('/api/filtros', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT f.id, f.nome, f.setor_id, f.equipamento_id, f.modelo_refil, f.data_ultima_troca, f.periodicidade_meses, f.observacoes,
               s.nome as setor_nome,
               e.nome as equipamento_nome, e.patrimonio as equipamento_patrimonio,
               DATE_ADD(f.data_ultima_troca, INTERVAL COALESCE(f.periodicidade_meses, 3) MONTH) as data_vencimento,
               DATEDIFF(DATE_ADD(f.data_ultima_troca, INTERVAL COALESCE(f.periodicidade_meses, 3) MONTH), CURDATE()) as dias_restantes
        FROM filtros_agua f
        LEFT JOIN setores s ON f.setor_id = s.id
        LEFT JOIN equipamentos e ON f.equipamento_id = e.id
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

// 2. CADASTRAR NOVO PONTO DE FILTRAGEM (Com suporte a equipamento_id opcional)
app.post('/api/filtros', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { nome, setor_id, equipamento_id, modelo_refil, data_ultima_troca, periodicidade_meses, observacoes } = req.body;
    
    const v_setor = setor_id ? Number(setor_id) : null;
    const v_equip = equipamento_id && equipamento_id !== "" && equipamento_id !== "null" ? Number(equipamento_id) : null;
    const v_periodo = periodicidade_meses ? Number(periodicidade_meses) : 3;
    const v_data = data_ultima_troca || new Date().toISOString().split('T')[0];

    const query = `
        INSERT INTO filtros_agua 
        (nome, setor_id, equipamento_id, modelo_refil, data_ultima_troca, periodicidade_meses, observacoes) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(query, [nome, v_setor, v_equip, modelo_refil || null, v_data, v_periodo, observacoes || null], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Ponto de filtragem monitorado com sucesso!", id: result.insertId });
    });
});

// 3. REGISTRAR TROCA / BAIXA DE REFIL NO ALMOXARIFADO
app.post('/api/filtros/baixa', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { filtro_id, tecnico_nome, obs_intervencao, item_id, quantity, quantidade } = req.body;
    const qtd_usada = Number(quantidade || quantity || 0);

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Atualiza a data da última troca na tabela filtros_agua
        const queryUpdate = `UPDATE filtros_agua SET data_ultima_troca = CURDATE() WHERE id = ?`;
        conn.query(queryUpdate, [filtro_id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            if (item_id && qtd_usada > 0) {
                // 2. Busca o valor unitário do item no estoque
                conn.query("SELECT nome, quantidade, valor_unitario FROM itens_estoque WHERE id = ?", [item_id], (errEstoque, results) => {
                    if (errEstoque || results.length === 0) {
                        return conn.rollback(() => { conn.release(); res.status(400).json({ error: "Item de refil não localizado no almoxarifado." }); });
                    }

                    const item = results[0];
                    if (item.quantidade < qtd_usada) {
                        return conn.rollback(() => { conn.release(); res.status(400).json({ error: `Estoque insuficiente! Saldo atual: ${item.quantidade} un.` }); });
                    }

                    const cubic_total = item.valor_unitario * qtd_usada;
                    const log_intervencao = `${obs_intervencao || 'Troca de refil.'} [Peça Deduzida: ${qtd_usada}x ${item.nome} | Custo Médio: R$ ${cubic_total.toFixed(2)}]`;

                    // 3. Atualiza o custo acumulado numérico do ponto de filtragem
                    const queryUpdateFiltro = `
                        UPDATE filtros_agua 
                        SET cubic_acumulado = cubic_acumulado + ?
                        WHERE id = ?`;

                    conn.query(queryUpdateFiltro, [cubic_total, filtro_id], (errCusto) => {
                        if (errCusto) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCusto.message }); });

                        // 4. Grava no histórico do módulo
                        const queryHist = `INSERT INTO filtros_historico (filtro_id, data_troca, tecnico_nome, obs_intervencao) VALUES (?, CURDATE(), ?, ?)`;
                        conn.query(queryHist, [filtro_id, tecnico_nome || 'Técnico', log_intervencao], (errHist) => {
                            if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                            // 5. Deduz a quantidade física do estoque do almoxarifado
                            conn.query("UPDATE itens_estoque SET quantidade = quantidade - ? WHERE id = ?", [qtd_usada, item_id], (errDeduz) => {
                                if (errDeduz) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errDeduz.message }); });

                                conn.commit((errCommit) => {
                                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                    conn.release();
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
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Troca registrada com sucesso!" });
                    });
                });
            }
        });
    });
});

// 4. RELATÓRIO DE TROCAS DE FILTROS
app.get('/api/filtros/relatorio', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { data_inicio, data_fim } = req.query;
    const inicio = data_inicio ? `${data_inicio} 00:00:00` : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim ? `${data_fim} 23:59:59` : new Date().toISOString().split('T')[0] + ' 23:59:59';

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

        results.forEach(row => {
            if (row.obs_intervencao && row.obs_intervencao.includes('Custo Médio: R$')) {
                try {
                    const partes = row.obs_intervencao.split('Custo Médio: R$');
                    if (partes[1]) {
                        const valorLimpo = partes[1].replace(']', '').trim();
                        custoTotalPeriodo += parseFloat(valorLimpo) || 0;
                    }
                } catch (e) {
                    console.error("Erro ao calcular valor da troca:", e);
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

// -------------------------------------------------------------------------
// MÓDULO DE DOCUMENTOS (AUDITÁVEL)
// -------------------------------------------------------------------------

// 1. ROTA DE UPLOAD: Salva o documento e faz as amarrações obrigatórias/opcionais
app.post('/api/documentos', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('arquivo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado." });
    }

    const { chamado_id, setor_id, equipamento_id, usuario_id } = req.body;

    // Validação obrigatória da auditoria
    if (!chamado_id || chamado_id === "null" || chamado_id === "undefined") {
        return res.status(400).json({ error: "Vínculo com o Chamado é obrigatório para auditoria." });
    }
    if (!usuario_id || usuario_id === "null" || usuario_id === "undefined") {
        return res.status(400).json({ error: "Identificação do Usuário é obrigatória para auditoria." });
    }

    const nome_original = req.file.originalname;
    const nome_armazenamento = req.file.filename;
    const url_arquivo = `/uploads/${req.file.filename}`;
    const tipo_mimetype = req.file.mimetype;

    // Sanatização dos IDs opcionais
    const v_chamado_id = Number(chamado_id);
    const v_usuario_id = Number(usuario_id);
    const v_setor_id = setor_id && setor_id !== "null" && setor_id !== "undefined" ? Number(setor_id) : null;
    const v_equipamento_id = equipamento_id && equipamento_id !== "null" && equipamento_id !== "undefined" ? Number(equipamento_id) : null;

    const query = `
        INSERT INTO documentos (nome_original, nome_armazenamento, url_arquivo, tipo_mimetype, chamado_id, setor_id, equipamento_id, usuario_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [nome_original, nome_armazenamento, url_arquivo, tipo_mimetype, v_chamado_id, v_setor_id, v_equipamento_id, v_usuario_id];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro ao salvar documento no banco:", err.message);
            return res.status(500).json({ error: err.message });
        }

        // Registrar no histórico cronológico do chamado que um anexo foi adicionado (Auditoria)
        const msgHist = `📎 Novo anexo adicionado: ${nome_original}`;
        const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, 'Sistema', ?, 'Em Atendimento', NOW())";
        
        db.query(queryHist, [v_chamado_id, msgHist], (errHist) => {
            if (errHist) console.error("⚠️ Falha ao gerar log de histórico do anexo:", errHist.message);
            
            res.status(201).json({ message: "Documento anexado com sucesso!", id: result.insertId });
        });
    });
});

// 2. ROTA DE CONSULTA: Retorna o histórico de documentos filtrados por Equipamento, Setor ou Chamado
app.get('/api/documentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { chamado_id, setor_id, equipamento_id } = req.query;

    let query = `
        SELECT d.id, d.nome_original, d.url_arquivo, d.tipo_mimetype, d.data_upload, d.chamado_id, d.equipamento_id, d.setor_id,
               u.nome as usuario_nome, s.nome as setor_nome, e.nome as equipamento_nome, e.patrimonio as equipamento_patrimonio
        FROM documentos d
        JOIN usuarios u ON d.usuario_id = u.id
        LEFT JOIN setores s ON d.setor_id = s.id
        LEFT JOIN equipamentos e ON d.equipamento_id = e.id
        WHERE 1=1
    `;
    const params = [];

    if (chamado_id) {
        query += ` AND d.chamado_id = ?`;
        params.push(Number(chamado_id));
    }
    if (setor_id) {
        query += ` AND d.setor_id = ?`;
        params.push(Number(setor_id));
    }
    if (equipamento_id) {
        query += ` AND d.equipamento_id = ?`;
        params.push(Number(equipamento_id));
    }

    query += ` ORDER BY d.data_upload DESC`;

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

// 🔄 LISTAR EQUIPAMENTOS EM RESERVA DO MESMO TIPO DO EQUIPAMENTO DO CHAMADO
app.get('/api/equipamentos/reservas', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { tipo_de_equipamento_com_base_em } = req.query;

    if (!tipo_de_equipamento_com_base_em) {
        return res.status(400).json({ error: "O ID do equipamento de referência é obrigatório." });
    }

    // Primeiro, descobre qual é o tipo_id do equipamento atual
    const queryTipo = `SELECT tipo_id, tipo_equipamento_id FROM equipamentos WHERE id = ?`;
    
    db.query(queryTipo, [Number(tipo_de_equipamento_com_base_em)], (errTipo, resultTipo) => {
        if (errTipo) return res.status(500).json({ error: errTipo.message });
        if (resultTipo.length === 0) return res.status(404).json({ error: "Equipamento de referência não encontrado." });

        const tipoId = resultTipo[0].tipo_id || resultTipo[0].tipo_equipamento_id;

        // Se o equipamento atual não possuir tipo configurado, trazemos reservas gerais
        let queryReservas = `
            SELECT e.id, e.nome, e.patrimonio, s.nome as setor_nome 
            FROM equipamentos e
            LEFT JOIN setores s ON e.setor_id = s.id
            WHERE e.status = 'Reserva'
        `;
        const queryParams = [];

        if (tipoId) {
            queryReservas += ` AND (e.tipo_id = ? OR e.tipo_equipamento_id = ?)`;
            queryParams.push(tipoId, tipoId);
        }

        queryReservas += ` ORDER BY e.nome ASC`;

        db.query(queryReservas, queryParams, (errRes, resultReservas) => {
            if (errRes) return res.status(500).json({ error: errRes.message });
            res.json(resultReservas || []);
        });
    });
});

// 🔄 EXECUTAR TROCA FÍSICA E ATUALIZAÇÃO DE HISTÓRICO DE AUDITORIA (TRANSAÇÃO)
app.post('/api/equipamentos/trocar', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { 
        equipamento_atual_id, 
        equipamento_reserva_id, 
        chamado_id, 
        tecnico_nome, 
        setor_destino_id 
    } = req.body;

    if (!equipamento_atual_id || !equipamento_reserva_id || !chamado_id || !setor_destino_id) {
        return res.status(400).json({ error: "Dados incompletos para processar a substituição." });
    }

    // Iniciando transação segura usando o padrão do seu db.js
    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        // Passo 1: Obter informações do equipamento antigo e novo para compor os logs detalhados
        const queryInfo = `SELECT id, nome, patrimonio, status, setor_id FROM equipamentos WHERE id IN (?, ?)`;
        conn.query(queryInfo, [equipamento_atual_id, equipamento_reserva_id], (errInfo, eqResults) => {
            if (errInfo || eqResults.length < 2) {
                return conn.rollback(() => {
                    conn.release();
                    res.status(400).json({ error: "Não foi possível localizar os dados de ambos os equipamentos." });
                });
            }

            const eqAntigo = eqResults.find(e => e.id === Number(equipamento_atual_id));
            const eqNovo = eqResults.find(e => e.id === Number(equipamento_reserva_id));

            // Passo 2: Atualizar Equipamento Antigo (Ativo -> Em Manutenção)
            const queryUpdateAntigo = `
                UPDATE equipamentos 
                SET status = 'Em Manutenção', 
                    setor_id = NULL 
                WHERE id = ?`;
            
            conn.query(queryUpdateAntigo, [equipamento_atual_id], (errUpAntigo) => {
                if (errUpAntigo) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpAntigo.message }); });

                // Passo 3: Atualizar Equipamento Reserva (Reserva -> Ativo e herda o setor/quarto)
                const queryUpdateNovo = `
                    UPDATE equipamentos 
                    SET status = 'Ativo', 
                        setor_id = ? 
                    WHERE id = ?`;

                conn.query(queryUpdateNovo, [setor_destino_id, equipamento_reserva_id], (errUpNovo) => {
                    if (errUpNovo) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpNovo.message }); });

                    // Passo 4: Registrar histórico do Equipamento Danificado que SAI
                    const logDescricaoAntigo = `Retirado do setor (ID: ${setor_destino_id}) due to falha relatada no Chamado #${chamado_id}. Substituído pelo Equipamento ${eqNovo.nome} (Pat: ${eqNovo.patrimonio}).`;
                    const queryHistAntigo = `
                        INSERT INTO equipamentos_historico 
                        (equipamento_id, setor_origem_id, setor_destino_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                        VALUES (?, ?, NULL, ?, 'Em Manutenção', ?, ?, NOW())`;

                    conn.query(queryHistAntigo, [equipamento_atual_id, eqAntigo.setor_id, eqAntigo.status, logDescricaoAntigo, tecnico_nome], (errHistA) => {
                        if (errHistA) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistA.message }); });

                        // Passo 5: Registrar histórico do Equipamento Reserva que ENTRA
                    const logDescricaoNovo = `Instalado no setor (ID: ${setor_destino_id}) em substituição ao Equipamento ${eqAntigo.nome} (Pat: ${eqAntigo.patrimonio}) através do Chamado #${chamado_id}.`;
                    const queryHistNovo = `
                        INSERT INTO equipamentos_historico 
                        (equipamento_id, setor_origem_id, setor_destino_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                        VALUES (?, NULL, ?, ?, 'Ativo', ?, ?, NOW())`;

                    conn.query(queryHistNovo, [equipamento_reserva_id, setor_destino_id, eqNovo.status, logDescricaoNovo, tecnico_nome], (errHistN) => {
                        if (errHistN) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistN.message }); });

                            // Passo 6: Atualizar chamado técnico para vincular o novo equipamento instalado
                            const queryUpdateChamado = `UPDATE chamados SET equipamento_id = ? WHERE id = ?`;
                            conn.query(queryUpdateChamado, [equipamento_reserva_id, chamado_id], (errChamado) => {
                                if (errChamado) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errChamado.message }); });

                                // Passo 7: Adicionar cronologia técnica ao histórico da OS
                                const msgHistOs = `[🔄 SUBSTITUIÇÃO DE ATIVO] Equipamento anterior (Pat: ${eqAntigo.patrimonio}) substituído por novo equipamento reserva (Pat: ${eqNovo.patrimonio}).`;
                                const queryHistOs = `
                                    INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) 
                                    VALUES (?, ?, ?, 'Em Atendimento', NOW())`;

                                conn.query(queryHistOs, [chamado_id, tecnico_nome, msgHistOs], (errHistOs) => {
                                    if (errHistOs) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistOs.message }); });

                                    // Commit Final se todas as operações executaram perfeitamente
                                    conn.commit((errCommit) => {
                                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                        conn.release();
                                        res.json({ message: "Troca e logs de rastreabilidade gravados com sucesso!" });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// -------------------------------------------------------------------------
// MÓDULO DE CONTROLE DE GASES MEDICINAIS (CORRIGIDO)
// -------------------------------------------------------------------------

// 1. CADASTRAR NOVO TIPO DE GÁS NO INVENTÁRIO
app.post('/api/gases', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { tipo_gas, capacidade_cilindro, estoque_minimo } = req.body;

    if (!tipo_gas || !capacidade_cilindro) {
        return res.status(400).json({ error: "O nome do gás e a capacidade do cilindro são obrigatórios." });
    }

    const query = `
        INSERT INTO gases_estoque (tipo_gas, capacidade_cilindro, estoque_minimo, quantidade_atual) 
        VALUES (?, ?, ?, 0)
    `;
    const values = [tipo_gas.trim(), Number(capacidade_cilindro), Number(estoque_minimo || 5)];

    db.query(query, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "Este tipo de gás já está cadastrado no sistema." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Novo tipo de gás cadastrado com sucesso!", id: result.insertId });
    });
});

// 2. LISTAR O SALDO ATUAL E TIPOS DE GASES CADASTRADOS
app.get('/api/gases', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT *, 
               (quantidade_atual * capacidade_cilindro) as volume_total_m3,
               (quantidade_atual <= estoque_minimo) as alerta_estoque
        FROM gases_estoque 
        ORDER BY tipo_gas ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

// 3. REGISTRAR COMPRA (ENTRADA DE CILINDROS CHEIOS)
app.post('/api/gases/entrada', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { tipo_gas_id, quantity_cilindros, quantidade_cilindros, valor_unitario_cilindro, tecnico_nome, observacao } = req.body;
    const qtd_entrada = Number(quantidade_cilindros || quantity_cilindros || 0);

    if (!tipo_gas_id || !qtd_entrada || !valor_unitario_cilindro) {
        return res.status(400).json({ error: "Dados incompletos para registrar a compra de gases." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE gases_estoque 
            SET quantidade_atual = quantidade_atual + ?, 
                valor_ultimo_cilindro = ? 
            WHERE id = ?
        `;
        
        conn.query(queryUpdate, [qtd_entrada, Number(valor_unitario_cilindro), Number(tipo_gas_id)], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            const queryHist = `
                INSERT INTO gases_movimentacoes 
                (tipo_gas_id, tipo_movimentacao, quantidade_cilindros, valor_unitario_cilindro, tecnico_responsavel, observacao) 
                VALUES (?, 'Entrada', ?, ?, ?, ?)
            `;
            const valuesHist = [
                Number(tipo_gas_id), 
                qtd_entrada, 
                Number(valor_unitario_cilindro), 
                tecnico_nome || 'Sistema', 
                observacao || "Entrada de lote de cilindros adquiridos."
            ];

            conn.query(queryHist, valuesHist, (errHist) => {
                if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.json({ message: "Compra de cilindros registrada e estoque abastecido!" });
                });
            });
        });
    });
});

// 4. REGISTRAR CONSUMO (BAIXA DE CILINDRO SECO NA CENTRAL)
app.post('/api/gases/consumo', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { tipo_gas_id, quantity_cilindros, quantidade_cilindros, tecnico_nome, observacao } = req.body;
    const qtd_baixa = Number(quantidade_cilindros || quantity_cilindros || 1);

    if (!tipo_gas_id) {
        return res.status(400).json({ error: "O ID do gás de referência é obrigatório." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT quantidade_atual, valor_ultimo_cilindro FROM gases_estoque WHERE id = ?", [Number(tipo_gas_id)], (errCheck, results) => {
            if (errCheck || results.length === 0) {
                return conn.rollback(() => { conn.release(); res.status(404).json({ error: "Tipo de gás não localizado." }); });
            }

            const estoque = results[0];
            if (estoque.quantidade_atual < qtd_baixa) {
                return conn.rollback(() => { 
                    conn.release(); 
                    res.status(400).json({ error: `Estoque insuficiente na central! Restam apenas ${estoque.quantidade_atual} cilindros.` }); 
                });
            }

            conn.query("UPDATE gases_estoque SET quantidade_atual = quantidade_atual - ? WHERE id = ?", [qtd_baixa, Number(tipo_gas_id)], (errUp) => {
                if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

                const queryHist = `
                    INSERT INTO gases_movimentacoes 
                    (tipo_gas_id, tipo_movimentacao, quantidade_cilindros, valor_unitario_cilindro, tecnico_responsavel, observacao) 
                    VALUES (?, 'Saida', ?, ?, ?, ?)
                `;
                const valuesHist = [
                    Number(tipo_gas_id), 
                    qtd_baixa, 
                    estoque.valor_ultimo_cilindro, 
                    tecnico_nome || 'Técnico de Plantão', 
                    observacao || "Substituição de cilindro vazio na central."
                ];

                conn.query(queryHist, valuesHist, (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Baixa de cilindro processada com sucesso!" });
                    });
                });
            });
        });
    });
});

// 5. EXTRATO / HISTÓRICO DE MOVIMENTAÇÕES DE GASES (Com Filtros)
app.get('/api/gases/historico', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { data_inicio, data_fim, tipo_movimentacao } = req.query;

    let query = `
        SELECT m.*, g.tipo_gas, g.capacidade_cilindro,
               (m.quantidade_cilindros * m.valor_unitario_cilindro) as cubic_total_movimentacao
        FROM gases_movimentacoes m
        JOIN gases_estoque g ON m.tipo_gas_id = g.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (tipo_movimentacao && tipo_movimentacao !== 'todos') {
        query += ` AND m.tipo_movimentacao = ?`;
        queryParams.push(tipo_movimentacao);
    }

    if (data_inicio && data_fim) {
        query += ` AND m.data_movimentacao BETWEEN ? AND ?`;
        queryParams.push(`${data_inicio} 00:00:00`, `${data_fim} 23:59:59`);
    }

    query += ` ORDER BY m.data_movimentacao DESC LIMIT 100`;

    db.query(query, queryParams, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));