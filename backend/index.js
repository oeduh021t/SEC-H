require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const saltRounds = 10;
const ExcelJS = require('exceljs');

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
    // Adiciona suporte a extensões e mimetypes de XML
    const extensoesPermitidas = /jpeg|jpg|png|pdf|xml/;
    const mimetypesPermitidos = /image\/(jpeg|jpg|png)|application\/pdf|application\/xml|text\/xml/;

    const extname = extensoesPermitidas.test(path.extname(file.originalname).toLowerCase());
    const mimetype = mimetypesPermitidos.test(file.mimetype);

    if (mimetype || extname) {
        return cb(null, true);
    } else {
        cb(new Error('Erro: O sistema aceita apenas arquivos no formato PDF, XML ou Imagem (JPEG, JPG, PNG)!'));
    }
};

// Instância do multer específica para documentos
const uploadDocumento = multer({
    storage: storage,
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
// DASHBOARD - MÉTRICAS COM SUPORTE A FILTRO DE DATA
// -------------------------------------------------------------------------
app.get('/api/stats', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { data_inicio, data_fim } = req.query;

    let filtroChamadosData = '';
    let filtroAberturaData = '';
    let paramsData = [];

    if (data_inicio && data_fim) {
        filtroChamadosData = ` AND data_abertura BETWEEN ? AND ?`;
        filtroAberturaData = ` WHERE data_abertura BETWEEN ? AND ?`;
        paramsData = [`${data_inicio} 00:00:00`, `${data_fim} 23:59:59`];
    }

    const queries = {
        totalEquipamentos: "SELECT COUNT(*) as total FROM equipamentos",
        chamadosAbertos: `SELECT COUNT(*) as total FROM chamados WHERE status = 'Aberto'${filtroChamadosData}`,
        chamadosAndamento: `SELECT COUNT(*) as total FROM chamados WHERE status = 'Em Atendimento'${filtroChamadosData}`,
        chamadosConcluidos: `SELECT COUNT(*) as total FROM chamados WHERE status = 'Concluído'${filtroChamadosData}`,
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
            ${filtroAberturaData}
            GROUP BY e.id 
            ORDER BY total DESC 
            LIMIT 5`,

        porTecnico: `
            SELECT tecnico_responsavel as nome, COUNT(*) as total
            FROM chamados WHERE tecnico_responsavel IS NOT NULL AND tecnico_responsavel != ''
            ${filtroChamadosData}
            GROUP BY tecnico_responsavel ORDER BY total DESC`,

        recentes: `SELECT id, titulo, status, data_abertura FROM chamados${filtroAberturaData} ORDER BY id DESC LIMIT 6`,

        gastoInsumosGerais: `
            SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0) as total 
            FROM chamados_itens ci
            JOIN chamados c ON ci.chamado_id = c.id
            JOIN itens_estoque i ON ci.item_id = i.id
            WHERE i.tipo != 'Filtro'${filtroChamadosData.replace('data_abertura', 'c.data_abertura')}`,

        gastoTotalEquipamentos: `
            SELECT (
                SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0)
                FROM chamados_itens ci
                JOIN chamados c ON ci.chamado_id = c.id
                WHERE c.equipamento_id IS NOT NULL${filtroChamadosData.replace('data_abertura', 'c.data_abertura')}
            ) + (
                SELECT IFNULL(SUM(custo_servico), 0)
                FROM chamados
                WHERE equipamento_id IS NOT NULL${filtroChamadosData}
            ) + (
                SELECT IFNULL(SUM(valor), 0)
                FROM equipamentos
            ) as total`,

        gastoTotalEstrutura: `
            SELECT (
                SELECT IFNULL(SUM(ci.quantidade * ci.valor_unitario_na_epoca), 0)
                FROM chamados_itens ci
                JOIN chamados c ON ci.chamado_id = c.id
                WHERE c.equipamento_id IS NULL${filtroChamadosData.replace('data_abertura', 'c.data_abertura')}
            ) + (
                SELECT IFNULL(SUM(custo_servico), 0)
                FROM chamados
                WHERE equipamento_id IS NULL${filtroChamadosData}
            ) as total`,

        boletosVencendoHoje: `SELECT COUNT(*) as total FROM boletos WHERE data_vencimento = CURDATE() AND status_pagamento != 'Pago'`,
        boletosAtrasados: `SELECT COUNT(*) as total FROM boletos WHERE data_vencimento < CURDATE() AND status_pagamento != 'Pago'`,
        boletosVencendoSemana: `SELECT COUNT(*) as total FROM boletos WHERE data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status_pagamento != 'Pago'`
    };

    const promises = Object.keys(queries).map(key => {
        return new Promise((resolve) => {
            const requerData = ['chamadosAbertos', 'chamadosAndamento', 'chamadosConcluidos', 'porEquipamento', 'porTecnico', 'recentes', 'gastoInsumosGerais', 'gastoTotalEquipamentos', 'gastoTotalEstrutura'].includes(key);
            const queryParams = (requerData && paramsData.length > 0) ? (key === 'gastoTotalEquipamentos' ? [...paramsData, ...paramsData] : paramsData) : [];

            db.query(queries[key], queryParams, (err, results) => {
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
                if (['gastoInsumosGerais', 'gastoTotalEquipamentos', 'gastoTotalEstrutura', 'boletosVencendoHoje', 'boletosAtrasados', 'boletosVencendoSemana'].includes(r.key)) {
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
        await axios.post(url, { chat_id, text: mensagem, parse_mode: 'Markdown' });
        console.log("✅ Notificação enviada ao Telegram");
    } catch (err) {
        const finalErr = err || { message: 'Erro desconhecido' };
        console.error("❌ Erro ao enviar Telegram:", finalErr.message);
    }
};

// -------------------------------------------------------------------------
// ROTAS DE EQUIPAMENTOS
// -------------------------------------------------------------------------
app.get('/api/equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id ORDER BY e.id DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.post('/api/equipamentos', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva, local_estoque_id, valor } = req.body;
    
    const foto_equipamento = req.file ? `/uploads/${req.file.filename}` : null;
    const v_nome = nome && nome.trim() !== "" ? nome : 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio.trim() : null;
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;
    const v_valor = valor && valor !== "" ? Number(valor) : 0.00;
    const v_data_preventiva = data_ultima_preventiva && data_ultima_preventiva.trim() !== "" ? data_ultima_preventiva : null;

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

app.put('/api/equipamentos/:id', permitirApenas(['admin', 'coordenador']), upload.single('foto_equipamento'), (req, res) => {
    const { id } = req.params;
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva, local_estoque_id, valor } = req.body;
    
    const v_nome = nome || 'Sem Nome';
    const v_modelo = modelo && modelo.trim() !== "" ? modelo : null;
    const v_patrimonio = patrimonio && patrimonio.trim() !== "" ? patrimonio.trim() : null;
    const v_num_serie = num_serie && num_serie.trim() !== "" ? num_serie : null;
    const v_fabricante = fabricante && fabricante.trim() !== "" ? fabricante : null;
    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    const v_tipo_id = tipo_id && tipo_id !== "" && tipo_id !== "null" ? Number(tipo_id) : null;
    const v_periodicidade = periodicidade_preventiva ? Number(periodicidade_preventiva) : 0;
    const v_status = status || 'Ativo';
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;
    const v_valor = valor && valor !== "" ? Number(valor) : 0.00;
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
        res.json({ message: "Dados atualizados com sucesso!" });
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
        SELECT 
            c.*, 
            s.nome as setor_nome, 
            e.nome as equip_nome, 
            e.patrimonio as equip_pat,
            u.nome as solicitante_nome,

            CASE 
                WHEN c.prioridade = 'Urgente' THEN 2
                WHEN c.prioridade = 'Alta' THEN 6
                WHEN c.prioridade = 'Média' THEN 24
                ELSE 48 
            END AS meta_sla_horas,

            TIMESTAMPDIFF(MINUTE, c.data_abertura, IFNULL(c.data_conclusao, NOW())) / 60.0 AS horas_gastas,

            CASE 
                WHEN c.status = 'Concluído' THEN
                    CASE 
                        WHEN TIMESTAMPDIFF(MINUTE, c.data_abertura, c.data_conclusao) <= (
                            CASE WHEN c.prioridade = 'Urgente' THEN 120 WHEN c.prioridade = 'Alta' THEN 360 WHEN c.prioridade = 'Média' THEN 1440 ELSE 2880 END
                        ) THEN 'Dentro do Prazo'
                        ELSE 'Estourou SLA'
                    END
                ELSE
                    CASE 
                        WHEN TIMESTAMPDIFF(MINUTE, c.data_abertura, NOW()) > (
                            CASE WHEN c.prioridade = 'Urgente' THEN 120 WHEN c.prioridade = 'Alta' THEN 360 WHEN c.prioridade = 'Média' THEN 1440 ELSE 2880 END
                        ) THEN 'SLA Atrasado'
                        ELSE 'No Prazo'
                    END
            END AS status_sla
        FROM chamados c
        LEFT JOIN setores s ON c.setor_id = s.id
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN usuarios u ON COALESCE(c.usuario_abertura_id, c.usuario_id) = u.id
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
        SELECT 
            c.*, 
            e.patrimonio, 
            e.num_serie, 
            e.nome as eq_nome, 
            e.modelo, 
            e.fabricante, 
            s.nome as setor_nome, 
            f.nome_fantasia as empresa_terceirizada,
            u.nome as solicitante_nome,

            CASE 
                WHEN c.prioridade = 'Urgente' THEN 2
                WHEN c.prioridade = 'Alta' THEN 6
                WHEN c.prioridade = 'Média' THEN 24
                ELSE 48 
            END AS meta_sla_horas,

            TIMESTAMPDIFF(MINUTE, c.data_abertura, IFNULL(c.data_conclusao, NOW())) / 60.0 AS horas_gastas,

            CASE 
                WHEN c.status = 'Concluído' THEN
                    CASE 
                        WHEN TIMESTAMPDIFF(MINUTE, c.data_abertura, c.data_conclusao) <= (
                            CASE WHEN c.prioridade = 'Urgente' THEN 120 WHEN c.prioridade = 'Alta' THEN 360 WHEN c.prioridade = 'Média' THEN 1440 ELSE 2880 END
                        ) THEN 'Dentro do Prazo'
                        ELSE 'Estourou SLA'
                    END
                ELSE
                    CASE 
                        WHEN TIMESTAMPDIFF(MINUTE, c.data_abertura, NOW()) > (
                            CASE WHEN c.prioridade = 'Urgente' THEN 120 WHEN c.prioridade = 'Alta' THEN 360 WHEN c.prioridade = 'Média' THEN 1440 ELSE 2880 END
                        ) THEN 'SLA Atrasado'
                        ELSE 'No Prazo'
                    END
            END AS status_sla
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN setores s ON c.setor_id = s.id
        LEFT JOIN fornecedores f ON c.fornecedor_id = f.id
        LEFT JOIN usuarios u ON COALESCE(c.usuario_abertura_id, c.usuario_id) = u.id
        WHERE c.id = ?
    `;

    db.query(queryChamado, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });

        const chamado = results[0];
        const queryHist = `SELECT * FROM chamados_historico WHERE chamado_id = ? ORDER BY data_registro DESC`;
        db.query(queryHist, [id], (errLogs, logs) => {
            if (errLogs) return res.status(500).json({ error: errLogs.message });
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
    
    const usuario_id = req.headers['x-usuario-id'] || req.body.usuario_id || null;
    const foto_abertura = req.file ? `/uploads/${req.file.filename}` : null;
    const categoryFinal = categoria || category || 'Manutenção';

    const v_setor_id = setor_id && setor_id !== "" && setor_id !== "null" && setor_id !== "undefined" ? Number(setor_id) : null;
    const v_equipamento_id = equipamento_id && equipamento_id !== "" && equipamento_id !== "null" && equipamento_id !== "undefined" ? Number(equipamento_id) : null;
    const v_usuario_id = usuario_id && usuario_id !== "" && usuario_id !== "null" && usuario_id !== "undefined" ? Number(usuario_id) : null;

    const query = `INSERT INTO chamados (setor_id, equipamento_id, usuario_abertura_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao, foto_abertura, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [v_setor_id, v_equipamento_id, v_usuario_id, titulo, descricao_problema, prioridade || 'Média', categoryFinal, tipo_manutencao || 'Corretiva', foto_abertura];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const novaOsId = result.insertId;

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
        tecnico_id 
    } = req.body;
    
    const tecnico_nome = tecnico_responsavel || "Técnico do Sistema";
    const v_tecnico_id = tecnico_id && tecnico_id !== "" ? Number(tecnico_id) : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE chamados
            SET status = ?, 
                tipo_atendimento = ?, 
                tecnico_responsavel = ?, 
                tecnico_id = ?, 
                fornecedor_id = ?, 
                nf_referencia = ?, 
                custo_servico = ?,
                data_conclusao = CASE WHEN ? = 'Concluído' THEN IFNULL(data_conclusao, NOW()) ELSE NULL END
            WHERE id = ?
        `;
        const valuesUpdate = [
            status, 
            tipo_atendimento, 
            tecnico_nome, 
            v_tecnico_id, 
            fornecedor_id || null, 
            nf_referencia || null, 
            custo_servico || 0, 
            status, 
            id
        ];

        conn.query(queryUpdate, valuesUpdate, (errUpdate) => {
            if (errUpdate) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpdate.message }); });

            if (descricao_solucao && descricao_solucao.trim() !== "") {
                const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
                conn.query(queryHist, [id, tecnico_nome, descricao_solucao, status], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Chamado e cronologia atualizados com sucesso!" });
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

                    conn.query("UPDATE itens_estoque SET quantidade = quantidade - ? WHERE id = ?", [qtd_solicitada, item_id], (errDeduz) => {
                        if (errDeduz) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errDeduz.message }); });

                        const msgEstoque = `Peça utilizada: ${qtd_solicitada}x ${item.nome}`;
                        const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, 'Sistema', ?, 'Em Atendimento', NOW())";

                        conn.query(queryHist, [id, msgEstoque], (errHist) => {
                            if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });
                            
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
            SET status = ?, 
                tecnico_responsavel = ?, 
                descricao_solucao = ?, 
                tipo_atendimento = ?,
                foto_conclusao = COALESCE(?, foto_conclusao),
                data_conclusao = CASE WHEN ? = 'Concluído' THEN IFNULL(data_conclusao, NOW()) ELSE NULL END
            WHERE id = ?
        `;
        const valuesUpdate = [status, tecnico_responsavel, descricao_solucao, tipo_atendimento, foto_conclusao, status, id];

        conn.query(queryUpdate, valuesUpdate, (errUpdate) => {
            if (errUpdate) return conn.rollback(() => { conn.release(); res.status(500).json(errUpdate); });

            const queryHist = `INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, ?, ?, ?, NOW())`;
            const msgHist = descricao_solucao || `Status alterado para ${status}`;

            conn.query(queryHist, [id, tecnico_responsavel, msgHist, status], (errHist) => {
                if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json(errHist); });
                
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

app.patch('/api/chamados/:id/assinar', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { id } = req.params;
    const { tipo, signatureBase64, assinaturaBase64, nome } = req.body;

    const imagemAssinatura = assinaturaBase64 || signatureBase64;
    const nomeDigitado = nome || req.body.nome_digitado;

    if (!imagemAssinatura) {
        return res.status(400).json({ error: "Dados da assinatura digital ausentes." });
    }

    const campoAssinatura = tipo === 'tecnico' ? 'assinatura_tecnico' : 'assinatura_setor';
    const campoNomeExtenso = tipo === 'tecnico' ? 'nome_tecnico' : 'nome_setor';

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
            DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY) as data_vencimento,
            DATEDIFF(DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY), CURDATE()) as dias_restantes
        FROM equipamentos e
        LEFT JOIN setores s ON e.setor_id = s.id
        LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id
        WHERE (e.status IN ('Ativo', 'Em Manutenção', 'Inoperante', 'Reserva'))
          AND e.periodicidade_preventiva > 0
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
    const url_anexo = req.file ? `/uploads/${req.file.filename}` : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json(err);
        
        conn.query("UPDATE equipamentos SET data_ultima_preventiva = CURDATE() WHERE id = ?", [equipamento_id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json(errUp); });
            
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
                res.json({ message: "Usuário e senha atualizados!" });
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
// MÓDULO DE EPIs
// -------------------------------------------------------------------------
app.get('/api/epis', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `
        SELECT f.id, f.usuario_id, u.nome as usuario_nome, u.login as usuario_login,
               f.data_entrega, f.observacao, f.url_termo, f.data_cadastro
        FROM epis_fichas f
        JOIN usuarios u ON f.usuario_id = u.id
        ORDER BY f.data_entrega DESC, f.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.post('/api/epis', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('termo_pdf'), (req, res) => {
    const { usuario_id, data_entrega, observacao } = req.body;

    if (!usuario_id) {
        return res.status(400).json({ error: "Selecione o colaborador que recebeu o EPI." });
    }

    const url_termo = req.file ? `/uploads/${req.file.filename}` : null;
    const v_data = data_entrega || new Date().toISOString().split('T')[0];

    const query = `
        INSERT INTO epis_fichas (usuario_id, data_entrega, observacao, url_termo)
        VALUES (?, ?, ?, ?)
    `;
    const values = [Number(usuario_id), v_data, observacao || null, url_termo];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro ao salvar registro de EPI:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Registro de EPI salvo com sucesso! 🥽✅", id: result.insertId });
    });
});

app.delete('/api/epis/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM epis_fichas WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Registro de EPI removido!" });
    });
});

// -------------------------------------------------------------------------
// RELATÓRIOS GERAIS
// -------------------------------------------------------------------------

// 1. RELATÓRIO DE ESTOQUE POR LOCAL (JSON)
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
            
            -- 2. Bloco de Equipamentos
            SELECT 
                e.id, 
                CONCAT(e.nome, ' (S/N: ', IFNULL(e.num_serie, 'N/A'), ')') AS nome,
                IFNULL(e.patrimonio, 'S/Patrimônio') AS referencia, 
                1 AS quantidade, 
                IFNULL(e.valor, 0.00) AS valor_unitario, -- 👈 CORRIGIDO: Puxa o valor de aquisição real do ativo
                IFNULL(e.data_ultima_preventiva, CURDATE()) AS data_cadastro,
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

    if (local_estoque_id && local_estoque_id !== 'todos') {
        query += ` AND local_estoque_id = ?`;
        queryParams.push(Number(local_estoque_id));
    }

    if (tipo_registro && tipo_registro !== 'todos') {
        query += ` AND tipo_registro = ?`;
        queryParams.push(tipo_registro);
    }

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

// 2. EXPORTAR ESTOQUE POR LOCAL (.XLSX)
app.get('/api/relatorios/exportar/estoque-local', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const { local_estoque_id, data_inicio, data_fim, tipo_registro } = req.query;

        let query = `
            SELECT * FROM (
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
                
                SELECT 
                    e.id, 
                    CONCAT(e.nome, ' (S/N: ', IFNULL(e.num_serie, 'N/A'), ')') AS nome,
                    IFNULL(e.patrimonio, 'S/Patrimônio') AS referencia, 
                    1 AS quantidade, 
                    IFNULL(e.valor, 0.00) AS valor_unitario, -- 👈 CORRIGIDO: Puxa o valor do ativo
                    IFNULL(e.data_ultima_preventiva, CURDATE()) AS data_cadastro,
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

        if (local_estoque_id && local_estoque_id !== 'todos') {
            query += ` AND local_estoque_id = ?`;
            queryParams.push(Number(local_estoque_id));
        }

        if (tipo_registro && tipo_registro !== 'todos') {
            query += ` AND tipo_registro = ?`;
            queryParams.push(tipo_registro);
        }

        if (data_inicio && data_fim) {
            query += ` AND data_cadastro BETWEEN ? AND ?`;
            queryParams.push(`${data_inicio} 00:00:00`, `${data_fim} 23:59:59`);
        }

        query += ` ORDER BY nome_estoque ASC, tipo_registro DESC, nome ASC`;

        db.query(query, queryParams, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Balanço de Estoque');

            worksheet.columns = [
                { header: 'Descrição / Especificação', key: 'nome', width: 35 },
                { header: 'Tipo', key: 'tipo_registro', width: 16 },
                { header: 'Origem / Estoque', key: 'nome_estoque', width: 25 },
                { header: 'Ref / Patrimônio', key: 'referencia', width: 20 },
                { header: 'Qtd', key: 'quantidade', width: 12 },
                { header: 'Preço Unit. (R$)', key: 'valor_unitario', width: 18 },
                { header: 'Subtotal (R$)', key: 'subtotal', width: 18 },
                { header: 'Detalhes / Observações', key: 'descricao', width: 40 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                const subtotal = Number(row.quantidade || 0) * Number(row.valor_unitario || 0);
                worksheet.addRow({
                    nome: row.nome,
                    tipo_registro: row.tipo_registro,
                    nome_estoque: row.nome_estoque,
                    referencia: row.referencia,
                    quantidade: Number(row.quantidade || 0),
                    valor_unitario: Number(row.valor_unitario || 0).toFixed(2),
                    subtotal: subtotal.toFixed(2),
                    descricao: row.descricao
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=balanco_estoque_local_${data_inicio || 'inicio'}_a_${data_fim || 'fim'}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. INVENTÁRIO GERAL (JSON)
app.get('/api/relatorios/inventario-geral', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { data_inicio, data_fim, setor_id, status, tipo_id, tipo_equipamento_id } = req.query;

    const inicio = data_inicio ? data_inicio + ' 00:00:00' : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim ? data_fim + ' 23:59:59' : new Date().toISOString().split('T')[0] + ' 23:59:59';

    let queryParams = [inicio, fim, inicio, fim];
    let filtrosAdicionais = [];

    if (setor_id && setor_id !== 'todos') {
        filtrosAdicionais.push('e.setor_id = ?');
        queryParams.push(Number(setor_id));
    }

    if (status && status !== 'todos') {
        filtrosAdicionais.push('e.status = ?');
        queryParams.push(status);
    }

    const tipoFiltro = tipo_id || tipo_equipamento_id;
    if (tipoFiltro && tipoFiltro !== 'todos') {
        filtrosAdicionais.push('(e.tipo_id = ? OR e.tipo_equipamento_id = ?)');
        queryParams.push(Number(tipoFiltro), Number(tipoFiltro));
    }

    const clausulaWhere = filtrosAdicionais.length > 0 
        ? `WHERE ${filtrosAdicionais.join(' AND ')}` 
        : '';

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

// 4. CUSTOS POR SETOR (JSON)
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
            s.caminho AS nome_setor,
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

// 5. DETALHAMENTO DE OSs POR SETOR (DRILL-DOWN)
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

// 6. QUANTIDADE DE CHAMADOS POR SETOR (JSON)
app.get('/api/relatorios/chamados-setor', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { data_inicio, data_fim, setor_id } = req.query;

    const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fim = data_fim || new Date().toISOString().split('T')[0];

    let queryParams = [inicio, fim];
    let filterSetor = '';

    if (setor_id && setor_id !== 'todos') {
        filterSetor = 'AND s.id = ?';
        queryParams.push(Number(setor_id));
    }

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
            s.caminho AS nome_setor,
            COUNT(c.id) AS total_chamados
        FROM ArvoreSetores s
        LEFT JOIN chamados c ON c.setor_id = s.id AND DATE(c.data_abertura) BETWEEN ? AND ?
        WHERE 1=1 ${filterSetor}
        GROUP BY s.id, s.caminho
        HAVING total_chamados > 0
        ORDER BY total_chamados DESC, s.caminho ASC
    `;

    db.query(sql, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Erro ao gerar relatório de chamados por setor:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(result || []);
    });
});

// EXPORTAR CRONOGRAMA DE PREVENTIVAS / PMOC (.XLSX)
app.get('/api/relatorios/exportar/preventivas', permitirApenas(['admin', 'coordenador', 'tecnico']), async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id, 
                e.nome, 
                e.patrimonio, 
                s.nome as setor_nome,
                IFNULL(t.nome, 'Geral') as tipo_nome,
                e.periodicidade_preventiva,
                e.data_ultima_preventiva, 
                DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY) as data_vencimento,
                DATEDIFF(DATE_ADD(COALESCE(e.data_ultima_preventiva, CURDATE()), INTERVAL e.periodicidade_preventiva DAY), CURDATE()) as dias_restantes
            FROM equipamentos e
            LEFT JOIN setores s ON e.setor_id = s.id
            LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id
            WHERE e.status IN ('Ativo', 'Em Manutenção', 'Inoperante', 'Reserva')
              AND e.periodicidade_preventiva > 0
            ORDER BY dias_restantes ASC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Cronograma PMOC');

            worksheet.columns = [
                { header: 'Equipamento', key: 'nome', width: 35 },
                { header: 'Patrimônio', key: 'patrimonio', width: 16 },
                { header: 'Setor / Localização', key: 'setor_nome', width: 25 },
                { header: 'Tipo / Categoria', key: 'tipo_nome', width: 20 },
                { header: 'Ciclo (Dias)', key: 'periodicidade', width: 14 },
                { header: 'Última Preventiva', key: 'ultima', width: 18 },
                { header: 'Próximo Vencimento', key: 'vencimento', width: 20 },
                { header: 'Situação Operacional', key: 'status_prazo', width: 25 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                let statusPrazo = `Restam ${row.dias_restantes} dias`;
                if (row.dias_restantes < 0) statusPrazo = `Atrasada há ${Math.abs(row.dias_restantes)} dias`;
                else if (row.dias_restantes === 0) statusPrazo = `Vence Hoje`;

                worksheet.addRow({
                    nome: row.nome,
                    patrimonio: row.patrimonio || 'S/P',
                    setor_nome: row.setor_nome || 'Não definido',
                    tipo_nome: row.tipo_nome,
                    periodicidade: `${row.periodicidade_preventiva} dias`,
                    ultima: row.data_ultima_preventiva ? new Date(row.data_ultima_preventiva).toLocaleDateString('pt-BR') : 'Pendente',
                    vencimento: row.data_vencimento ? new Date(row.data_vencimento).toLocaleDateString('pt-BR') : '---',
                    status_prazo: statusPrazo
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=cronograma_preventivas_pmoc_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR ESTRUTURA DE SETORES E ORGANOGRAMA (.XLSX)
app.get('/api/relatorios/exportar/setores', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const sql = `
            WITH RECURSIVE ArvoreSetores AS (
                SELECT id, setor_pai_id, nome, CAST(nome AS CHAR(1000)) as caminho, 1 as nivel
                FROM setores
                WHERE setor_pai_id IS NULL OR setor_pai_id = 0
                
                UNION ALL
                
                SELECT filho.id, filho.setor_pai_id, filho.nome, CONCAT(pai.caminho, ' > ', filho.nome), pai.nivel + 1
                FROM setores filho
                INNER JOIN ArvoreSetores pai ON filho.setor_pai_id = pai.id
            )
            SELECT id, nome, caminho, nivel
            FROM ArvoreSetores
            ORDER BY caminho ASC;
        `;

        db.query(sql, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Setores e Localizações');

            worksheet.columns = [
                { header: 'ID', key: 'id', width: 8 },
                { header: 'Nome da Sala / Local', key: 'nome', width: 28 },
                { header: 'Árvore Completa de Localização', key: 'caminho', width: 45 },
                { header: 'Nível Hierárquico', key: 'nivel', width: 18 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    id: row.id,
                    nome: row.nome,
                    caminho: row.caminho,
                    nivel: row.nivel === 1 ? 'Prédio / Principal' : `Nível ${row.nivel} (Subsetor)`
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=estrutura_setores_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR SOLICITAÇÕES DE COMPRA (.XLSX)
app.get('/api/relatorios/exportar/solicitacoes-compra', permitirApenas(['admin', 'coordenador', 'tecnico']), async (req, res) => {
    try {
        const query = `
            SELECT 
                sc.id,
                sc.data_solicitacao,
                u.nome AS solicitante_nome,
                s.nome AS setor_nome,
                f.nome_fantasia AS fornecedor_nome,
                e.nome AS equipamento_nome,
                sc.urgencia,
                sc.status,
                sc.motivo,
                (SELECT COUNT(*) FROM solicitacoes_compra_itens sci WHERE sci.solicitacao_id = sc.id) AS total_itens,
                (SELECT IFNULL(SUM(sci.quantidade * sci.valor_estimado), 0) FROM solicitacoes_compra_itens sci WHERE sci.solicitacao_id = sc.id) AS valor_total_estimado
            FROM solicitacoes_compra sc
            LEFT JOIN usuarios u ON sc.solicitante_id = u.id
            LEFT JOIN setores s ON sc.setor_id = s.id
            LEFT JOIN fornecedores f ON sc.fornecedor_id = f.id
            LEFT JOIN equipamentos e ON sc.equipamento_id = e.id
            ORDER BY sc.id DESC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Solicitações de Compra');

            worksheet.columns = [
                { header: 'Nº Pedido', key: 'id', width: 12 },
                { header: 'Data', key: 'data_solicitacao', width: 15 },
                { header: 'Solicitante', key: 'solicitante_nome', width: 25 },
                { header: 'Setor Alvo', key: 'setor_nome', width: 22 },
                { header: 'Fornecedor Sugerido', key: 'fornecedor_nome', width: 28 },
                { header: 'Ativo Vinculado', key: 'equipamento_nome', width: 25 },
                { header: 'Urgência', key: 'urgencia', width: 14 },
                { header: 'Status Atual', key: 'status', width: 16 },
                { header: 'Qtd Itens', key: 'total_itens', width: 12 },
                { header: 'Valor Total Estimado (R$)', key: 'valor_total_estimado', width: 25 },
                { header: 'Motivo / Justificativa', key: 'motivo', width: 45 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    id: `#${row.id}`,
                    data_solicitacao: row.data_solicitacao ? new Date(row.data_solicitacao).toLocaleDateString('pt-BR') : '',
                    solicitante_nome: row.solicitante_nome || 'Não informado',
                    setor_nome: row.setor_nome || 'Geral',
                    fornecedor_nome: row.fornecedor_nome || 'A definir / Cotação',
                    equipamento_nome: row.equipamento_nome || 'Nenhum',
                    urgencia: row.urgencia,
                    status: row.status,
                    total_itens: Number(row.total_itens || 0),
                    valor_total_estimado: Number(row.valor_total_estimado || 0).toFixed(2),
                    motivo: row.motivo
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=requisicoes_compras_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR RELATÓRIO DE NOTAS FISCAIS E CONTAS (.XLSX)
app.get('/api/relatorios/exportar/notas-fiscais', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const query = `
            SELECT 
                nf.id,
                nf.numero_nf,
                nf.serie,
                f.nome_fantasia AS fornecedor_nome,
                nf.data_emissao,
                nf.data_recebimento,
                nf.valor_total,
                (SELECT COUNT(*) FROM boletos b WHERE b.nota_fiscal_id = nf.id) AS total_boletos,
                (SELECT COUNT(*) FROM boletos b WHERE b.nota_fiscal_id = nf.id AND b.status_pagamento = 'Pendente' AND b.data_vencimento < CURDATE()) AS boletos_atrasados,
                (SELECT COUNT(*) FROM boletos b WHERE b.nota_fiscal_id = nf.id AND b.status_pagamento = 'Pendente' AND b.data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 5 DAY)) AS boletos_vencendo_breve
            FROM notas_fiscais nf
            LEFT JOIN fornecedores f ON nf.fornecedor_id = f.id
            ORDER BY nf.data_emissao DESC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Notas Fiscais');

            worksheet.columns = [
                { header: 'Nº NF', key: 'numero_nf', width: 14 },
                { header: 'Série', key: 'serie', width: 10 },
                { header: 'Fornecedor', key: 'fornecedor_nome', width: 30 },
                { header: 'Data Emissão', key: 'data_emissao', width: 15 },
                { header: 'Data Recebimento', key: 'data_recebimento', width: 18 },
                { header: 'Valor Total (R$)', key: 'valor_total', width: 20 },
                { header: 'Total Boletos', key: 'total_boletos', width: 14 },
                { header: 'Situação Financeira', key: 'situacao', width: 24 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                let situacao = 'Em Dia / Quitado';
                if (Number(row.total_boletos) === 0) situacao = 'Sem Boletos';
                else if (Number(row.boletos_atrasados) > 0) situacao = `🚨 ${row.boletos_atrasados} Atrasado(s)`;
                else if (Number(row.boletos_vencendo_breve) > 0) situacao = `⏳ Vencendo em breve`;

                worksheet.addRow({
                    numero_nf: row.numero_nf,
                    serie: row.serie || 'Única',
                    fornecedor_nome: row.fornecedor_nome || 'Não informado',
                    data_emissao: row.data_emissao ? new Date(row.data_emissao).toLocaleDateString('pt-BR') : '',
                    data_recebimento: row.data_recebimento ? new Date(row.data_recebimento).toLocaleDateString('pt-BR') : '',
                    valor_total: Number(row.valor_total || 0).toFixed(2),
                    total_boletos: Number(row.total_boletos || 0),
                    situacao: situacao
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=relatorio_notas_fiscais_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR RELATÓRIO DE FORNECEDORES (.XLSX)
app.get('/api/relatorios/exportar/fornecedores', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const query = `
            SELECT 
                f.id,
                f.nome_fantasia,
                f.razao_social,
                f.cnpj,
                f.especialidade,
                f.contato,
                f.telefone,
                f.email,
                f.status,
                IF(f.contrato_url IS NOT NULL AND f.contrato_url != '', 'Possui Contrato Anexado', 'Sem Contrato') AS situacao_contrato
            FROM fornecedores f
            ORDER BY f.nome_fantasia ASC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Fornecedores Cadastrados');

            worksheet.columns = [
                { header: 'ID', key: 'id', width: 8 },
                { header: 'Nome Fantasia', key: 'nome_fantasia', width: 30 },
                { header: 'Razão Social', key: 'razao_social', width: 35 },
                { header: 'CNPJ', key: 'cnpj', width: 22 },
                { header: 'Especialidade / Ramo', key: 'especialidade', width: 25 },
                { header: 'Representante', key: 'contato', width: 22 },
                { header: 'Telefone', key: 'telefone', width: 18 },
                { header: 'E-mail', key: 'email', width: 30 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Contrato', key: 'situacao_contrato', width: 25 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    id: `#${row.id}`,
                    nome_fantasia: row.nome_fantasia,
                    razao_social: row.razao_social || 'Não informada',
                    cnpj: row.cnpj || 'SEM CNPJ',
                    especialidade: row.especialidade || 'Geral',
                    contato: row.contato || '---',
                    telefone: row.telefone || '---',
                    email: row.email || '---',
                    status: row.status || 'Ativo',
                    situacao_contrato: row.situacao_contrato
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=relatorio_fornecedores_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR CRONOGRAMA DE FILTROS E REFIS (.XLSX)
app.get('/api/relatorios/exportar/filtros', permitirApenas(['admin', 'coordenador', 'tecnico']), async (req, res) => {
    try {
        const query = `
            SELECT 
                f.id,
                f.nome,
                s.nome AS setor_nome,
                e.nome AS equipamento_nome,
                e.patrimonio AS equipamento_patrimonio,
                f.modelo_refil,
                f.periodicidade_meses,
                f.data_ultima_troca,
                DATE_ADD(f.data_ultima_troca, INTERVAL f.periodicidade_meses MONTH) AS data_vencimento,
                DATEDIFF(DATE_ADD(f.data_ultima_troca, INTERVAL f.periodicidade_meses MONTH), CURDATE()) AS dias_restantes
            FROM filtros_agua f
            LEFT JOIN setores s ON f.setor_id = s.id
            LEFT JOIN equipamentos e ON f.equipamento_id = e.id
            ORDER BY dias_restantes ASC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Cronograma Filtros');

            worksheet.columns = [
                { header: 'Ponto / Identificação', key: 'nome', width: 30 },
                { header: 'Setor / Localização', key: 'setor_nome', width: 25 },
                { header: 'Ativo Vinculado', key: 'equipamento', width: 30 },
                { header: 'Modelo do Refil', key: 'modelo_refil', width: 24 },
                { header: 'Periodicidade (Meses)', key: 'periodicidade', width: 20 },
                { header: 'Última Troca', key: 'ultima_troca', width: 16 },
                { header: 'Próximo Vencimento', key: 'vencimento', width: 20 },
                { header: 'Situação Operacional', key: 'situacao', width: 25 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                let situacao = `Restam ${row.dias_restantes} dias`;
                if (row.dias_restantes < 0) situacao = `🚨 Vencido há ${Math.abs(row.dias_restantes)} dias`;
                else if (row.dias_restantes === 0) situacao = `⚠️ Vence Hoje`;

                const equipTexto = row.equipamento_nome 
                    ? `${row.equipamento_nome} (PAT: ${row.equipamento_patrimonio || 'S/P'})` 
                    : 'Ponto Avulso / Parede';

                worksheet.addRow({
                    nome: row.nome,
                    setor_nome: row.setor_nome || 'Geral',
                    equipamento: equipTexto,
                    modelo_refil: row.modelo_refil || 'Padrão',
                    periodicidade: `${row.periodicidade_meses} meses`,
                    ultima_troca: row.data_ultima_troca ? new Date(row.data_ultima_troca).toLocaleDateString('pt-BR') : '---',
                    vencimento: row.data_vencimento ? new Date(row.data_vencimento).toLocaleDateString('pt-BR') : '---',
                    situacao: situacao
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=cronograma_filtros_agua_${new Date().toISOString().slice(0, 10)}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// -------------------------------------------------------------------------
// LOGÍSTICA / AUXILIARES
// -------------------------------------------------------------------------
app.get('/api/setores', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        WITH RECURSIVE ArvoreSetores AS (
            SELECT id, setor_pai_id, nome, CAST(nome AS CHAR(1000)) as caminho
            FROM setores
            WHERE setor_pai_id IS NULL OR setor_pai_id = 0
            
            UNION ALL
            
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

app.get('/api/tipos-equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query(`SELECT id, nome FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

app.get('/api/types_equipamentos', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query(`SELECT * FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

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

app.delete('/api/tipos-equipamentos/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;

    const queryCheck = `SELECT COUNT(*) as em_uso FROM equipamentos WHERE tipo_id = ? OR tipo_equipamento_id = ?`;
    
    db.query(queryCheck, [id, id], (errCheck, resultsCheck) => {
        if (errCheck) return res.status(500).json({ error: errCheck.message });
        
        if (resultsCheck[0].em_uso > 0) {
            return res.status(400).json({ 
                error: `Não é possível excluir! Existem ${resultsCheck[0].em_uso} equipamentos ativos utilizando este tipo no inventário.` 
            });
        }

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
    const { nome, descricao, quantidade, valor_unitario, estoque_minimo, num_nota, referencia, local_estoque_id } = req.body;
    
    const qtd = Number(quantidade) || 0;
    const valor = Number(valor_unitario) || 0.00;
    const min = Number(estoque_minimo) || 5;
    const ref_limpa = referencia && referencia.trim() !== "" ? referencia.trim() : null;
    const v_local_estoque_id = local_estoque_id && local_estoque_id !== "" && local_estoque_id !== "null" ? Number(local_estoque_id) : null;

    db.beginTransaction((err, conn) => {
        if (err) {
            console.error("Erro ao iniciar transação:", err);
            return res.status(500).json({ error: err.message });
        }

        const queryItem = `
            INSERT INTO itens_estoque (nome, referencia, descricao, quantidade, valor_unitario, estoque_minimo, data_cadastro, data_atualizacao, local_estoque_id) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
        `;
        
        conn.query(queryItem, [nome.trim(), ref_limpa, descricao || null, qtd, valor, min, v_local_estoque_id], (errItem, resultItem) => {
            if (errItem) {
                console.error("❌ Erro ao inserir na tabela principal de estoque:", errItem.message);
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
// NOTAS FISCAIS E BOLETOS
// -------------------------------------------------------------------------
app.get('/api/notas-fiscais', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const query = `
        SELECT 
            nf.*, 
            f.nome_fantasia as fornecedor_nome,
            COUNT(b.id) as total_boletos,
            SUM(CASE WHEN b.status_pagamento != 'Pago' AND b.data_vencimento < CURDATE() THEN 1 ELSE 0 END) as boletos_atrasados,
            SUM(CASE WHEN b.status_pagamento != 'Pago' AND b.data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 5 DAY) THEN 1 ELSE 0 END) as boletos_vencendo_breve,
            MIN(CASE WHEN b.status_pagamento != 'Pago' THEN b.data_vencimento ELSE NULL END) as proximo_vencimento
        FROM notas_fiscais nf
        JOIN fornecedores f ON nf.fornecedor_id = f.id
        LEFT JOIN boletos b ON b.nota_fiscal_id = nf.id
        GROUP BY nf.id
        ORDER BY boletos_atrasados DESC, boletos_vencendo_breve DESC, nf.data_emissao DESC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

app.get('/api/notas-fiscais/:id/boletos', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const query = `SELECT * FROM boletos WHERE nota_fiscal_id = ? ORDER BY data_vencimento ASC`;
    
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

// 🚀 ROTA CORRIGIDA: INSERE A NOTA, CRIA/ATUALIZA O ESTOQUE E REGISTRA AS ENTRADAS
app.post('/api/notas-fiscais', permitirApenas(['admin', 'coordenador']), uploadDocumento.fields([
    { name: 'xml', maxCount: 1 },
    { name: 'danfe', maxCount: 1 }
]), (req, res) => {
    const { numero_nf, serie, chave_acesso, fornecedor_id, data_emissao, data_recebimento, valor_total, descricao, itens } = req.body;

    const url_xml = req.files && req.files['xml'] && req.files['xml'][0] ? `/uploads/${req.files['xml'][0].filename}` : null;
    const url_danfe = req.files && req.files['danfe'] && req.files['danfe'][0] ? `/uploads/${req.files['danfe'][0].filename}` : null;

    let listaItens = [];
    if (itens) {
        try {
            listaItens = typeof itens === 'string' ? JSON.parse(itens) : itens;
        } catch (e) {
            console.error("Erro no JSON.parse dos itens da NF:", e);
            listaItens = [];
        }
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryNF = `
            INSERT INTO notas_fiscais (numero_nf, serie, chave_acesso, fornecedor_id, data_emissao, data_recebimento, valor_total, descricao, url_xml, url_danfe)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const valuesNF = [
            numero_nf, 
            serie || null, 
            chave_acesso || null, 
            Number(fornecedor_id), 
            data_emissao, 
            data_recebimento || null, 
            Number(valor_total), 
            descricao || null, 
            url_xml, 
            url_danfe
        ];

        conn.query(queryNF, valuesNF, async (errNF, resultNF) => {
            if (errNF) {
                return conn.rollback(() => {
                    conn.release();
                    console.error("❌ Erro ao inserir nota fiscal:", errNF.message);
                    res.status(500).json({ error: errNF.message });
                });
            }

            const notaFiscalId = resultNF.insertId;

            // Se não tiver itens, finaliza salvando só a nota
            if (!listaItens || !Array.isArray(listaItens) || listaItens.length === 0) {
                return conn.commit((errCommit) => {
                    if (errCommit) {
                        return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    }
                    conn.release();
                    return res.status(201).json({ message: "Nota Fiscal cadastrada com sucesso!", id: notaFiscalId });
                });
            }

            // Processa e atualiza o estoque para cada item
            try {
                for (const item of listaItens) {
                    const qtd = Number(item.quantidade || 0);
                    const vUnit = Number(item.valor_unitario || 0);

                    if (qtd <= 0) continue;

                    let finalItemId = item.item_id ? Number(item.item_id) : null;

                    // Se for item existente: atualiza quantidade e valor no estoque
                    if (finalItemId) {
                        await new Promise((resolve, reject) => {
                            const qUpdate = `
                                UPDATE itens_estoque 
                                SET quantidade = quantidade + ?, 
                                    valor_unitario = IF(? > 0, ?, valor_unitario),
                                    data_atualizacao = NOW()
                                WHERE id = ?
                            `;
                            conn.query(qUpdate, [qtd, vUnit, vUnit, finalItemId], (errUp) => {
                                if (errUp) return reject(errUp);
                                resolve();
                            });
                        });
                    } else {
                        // Se for novo insumo: cadastra na tabela itens_estoque
                        const nomeInsumo = (item.nome || 'Novo Insumo').trim();
                        const refInsumo = item.referencia && item.referencia.trim() !== '' ? item.referencia.trim() : null;
                        const localEstoqueId = item.local_estoque_id ? Number(item.local_estoque_id) : null;

                        finalItemId = await new Promise((resolve, reject) => {
                            const qInsert = `
                                INSERT INTO itens_estoque (nome, referencia, quantidade, valor_unitario, local_estoque_id, data_cadastro, data_atualizacao)
                                VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                            `;
                            conn.query(qInsert, [nomeInsumo, refInsumo, qtd, vUnit, localEstoqueId], (errIns, resIns) => {
                                if (errIns) return reject(errIns);
                                resolve(resIns.insertId);
                            });
                        });
                    }

                    // Registra no histórico de entradas de estoque (itens_estoque_entradas)
                    await new Promise((resolve, reject) => {
                        const qEntrada = `
                            INSERT INTO itens_estoque_entradas (item_id, nota_fiscal_id, quantidade, valor_unitario, num_nota, data_entrada)
                            VALUES (?, ?, ?, ?, ?, NOW())
                        `;
                        conn.query(qEntrada, [finalItemId, notaFiscalId, qtd, vUnit, numero_nf], (errEnt) => {
                            if (errEnt) return reject(errEnt);
                            resolve();
                        });
                    });
                }

                conn.commit((errCommit) => {
                    if (errCommit) {
                        return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    }
                    conn.release();
                    res.status(201).json({ message: "Nota Fiscal, itens e estoque lançados com sucesso! 📦🧾", id: notaFiscalId });
                });
            } catch (errProcess) {
                conn.rollback(() => {
                    conn.release();
                    console.error("❌ Erro no processamento de itens do estoque:", errProcess.message);
                    res.status(500).json({ error: errProcess.message });
                });
            }
        });
    });
});

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

app.delete('/api/notas-fiscais/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query(`DELETE FROM notas_fiscais WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Nota Fiscal e seus boletos associados foram deletados!" });
    });
});

// -------------------------------------------------------------------------
// LOCAIS DE ESTOQUE
// -------------------------------------------------------------------------
app.get('/api/locais-estoque', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query("SELECT * FROM locais_estoque WHERE status = 'Ativo' ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

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
    const query = "SELECT id, nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status, contrato_url FROM fornecedores ORDER BY nome_fantasia ASC";
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result || []);
    });
});

app.post('/api/fornecedores', permitirApenas(['admin', 'coordenador']), uploadDocumento.single('contrato'), (req, res) => {
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade } = req.body;
    const contrato_url = req.file ? `/uploads/${req.file.filename}` : null;

    const query = "INSERT INTO fornecedores (nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status, contrato_url) VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativo', ?)";
    const values = [nome_fantasia, razao_social || null, cnpj || null, contato || null, telefone || null, email || null, especialidade || null, contrato_url];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor cadastrado com sucesso!", id: result.insertId, contrato_url });
    });
});

app.put('/api/fornecedores/:id', permitirApenas(['admin', 'coordenador']), uploadDocumento.single('contrato'), (req, res) => {
    const { id } = req.params;
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status } = req.body;

    if (req.file) {
        const contrato_url = `/uploads/${req.file.filename}`;
        const query = "UPDATE fornecedores SET nome_fantasia=?, razao_social=?, cnpj=?, contato=?, telefone=?, email=?, especialidade=?, status=?, contrato_url=? WHERE id=?";
        const values = [nome_fantasia, razao_social || null, cnpj || null, contato || null, telefone || null, email || null, especialidade || null, status, contrato_url, id];

        db.query(query, values, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Fornecedor atualizado com sucesso!", contrato_url });
        });
    } else {
        const query = "UPDATE fornecedores SET nome_fantasia=?, razao_social=?, cnpj=?, contato=?, telefone=?, email=?, especialidade=?, status=? WHERE id=?";
        const values = [nome_fantasia, razao_social || null, cnpj || null, contato || null, telefone || null, email || null, especialidade || null, status, id];

        db.query(query, values, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Fornecedor atualizado com sucesso!" });
        });
    }
});

app.delete('/api/fornecedores/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM fornecedores WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor removido com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// FILTROS DE ÁGUA
// -------------------------------------------------------------------------
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

app.post('/api/filtros/baixa', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { filtro_id, tecnico_nome, obs_intervencao, item_id, quantity, quantidade } = req.body;
    const qtd_usada = Number(quantidade || quantity || 0);

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `UPDATE filtros_agua SET data_ultima_troca = CURDATE() WHERE id = ?`;
        conn.query(queryUpdate, [filtro_id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            if (item_id && qtd_usada > 0) {
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

                    const queryUpdateFiltro = `
                        UPDATE filtros_agua 
                        SET cubic_acumulado = cubic_acumulado + ?
                        WHERE id = ?`;

                    conn.query(queryUpdateFiltro, [cubic_total, filtro_id], (errCusto) => {
                        if (errCusto) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCusto.message }); });

                        const queryHist = `INSERT INTO filtros_historico (filtro_id, data_troca, tecnico_nome, obs_intervencao) VALUES (?, CURDATE(), ?, ?)`;
                        conn.query(queryHist, [filtro_id, tecnico_nome || 'Técnico', log_intervencao], (errHist) => {
                            if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

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
// MÓDULO DE DOCUMENTOS
// -------------------------------------------------------------------------
app.post('/api/documentos', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('arquivo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado." });
    }

    const { chamado_id, setor_id, equipamento_id, usuario_id } = req.body;

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

        const msgHist = `📎 Novo anexo adicionado: ${nome_original}`;
        const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, 'Sistema', ?, 'Em Atendimento', NOW())";
        
        db.query(queryHist, [v_chamado_id, msgHist], (errHist) => {
            if (errHist) console.error("⚠️ Falha ao gerar log de histórico do anexo:", errHist.message);
            res.status(201).json({ message: "Documento anexado com sucesso!", id: result.insertId });
        });
    });
});

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

// -------------------------------------------------------------------------
// TROCAS E RESERVAS
// -------------------------------------------------------------------------
app.get('/api/equipamentos/reservas', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { tipo_de_equipamento_com_base_em } = req.query;

    if (!tipo_de_equipamento_com_base_em) {
        return res.status(400).json({ error: "O ID do equipamento de referência é obrigatório." });
    }

    const queryTipo = `SELECT id, tipo_id, tipo_equipamento_id FROM equipamentos WHERE id = ?`;
    
    db.query(queryTipo, [Number(tipo_de_equipamento_com_base_em)], (errTipo, resultTipo) => {
        if (errTipo) return res.status(500).json({ error: errTipo.message });
        if (resultTipo.length === 0) return res.status(404).json({ error: "Equipamento de referência não encontrado." });

        const tipoId = resultTipo[0].tipo_id || resultTipo[0].tipo_equipamento_id;

        let queryReservas = `
            SELECT e.id, e.nome, e.patrimonio, e.status, IFNULL(s.nome, 'Sem Setor / Reserva') as setor_nome 
            FROM equipamentos e
            LEFT JOIN setores s ON e.setor_id = s.id
            WHERE e.id != ? AND e.status IN ('Reserva', 'Ativo')
        `;
        const queryParams = [Number(tipo_de_equipamento_com_base_em)];

        if (tipoId) {
            queryReservas += ` AND (e.tipo_id = ? OR e.tipo_equipamento_id = ?)`;
            queryParams.push(tipoId, tipoId);
        }

        queryReservas += ` ORDER BY e.status DESC, e.nome ASC`;

        db.query(queryReservas, queryParams, (errRes, resultReservas) => {
            if (errRes) return res.status(500).json({ error: errRes.message });
            res.json(resultReservas || []);
        });
    });
});

app.post('/api/equipamentos/trocar', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { 
        equipamento_atual_id, 
        equipamento_reserva_id,
        chamado_id, 
        tecnico_nome, 
        setor_destino_id 
    } = req.body;

    if (!equipamento_atual_id || !equipamento_reserva_id || !setor_destino_id) {
        return res.status(400).json({ error: "Dados incompletos para processar a substituição." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

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

            const queryUpdateAntigo = `
                UPDATE equipamentos 
                SET status = 'Inoperante', 
                    setor_id = NULL 
                WHERE id = ?`;
            
            conn.query(queryUpdateAntigo, [equipamento_atual_id], (errUpAntigo) => {
                if (errUpAntigo) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpAntigo.message }); });

                const queryUpdateNovo = `
                    UPDATE equipamentos 
                    SET status = 'Ativo', 
                        setor_id = ? 
                    WHERE id = ?`;

                conn.query(queryUpdateNovo, [setor_destino_id, equipamento_reserva_id], (errUpNovo) => {
                    if (errUpNovo) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpNovo.message }); });

                    const logDescricaoAntigo = `Retirado do setor devido a avaria relatada${chamado_id ? ` na OS #${chamado_id}` : ''}. Substituído pelo equipamento ${eqNovo.nome} (Pat: ${eqNovo.patrimonio}).`;
                    const queryHistAntigo = `
                        INSERT INTO equipamentos_historico 
                        (equipamento_id, setor_origem_id, setor_destino_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                        VALUES (?, ?, NULL, ?, 'Inoperante', ?, ?, NOW())`;

                    conn.query(queryHistAntigo, [equipamento_atual_id, eqAntigo.setor_id, eqAntigo.status, logDescricaoAntigo, tecnico_nome || 'Técnico'], (errHistA) => {
                        if (errHistA) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistA.message }); });

                        const logDescricaoNovo = `Instalado no setor (ID: ${setor_destino_id}) em substituição/permuta ao equipamento ${eqAntigo.nome} (Pat: ${eqAntigo.patrimonio}).`;
                        const queryHistNovo = `
                            INSERT INTO equipamentos_historico 
                            (equipamento_id, setor_origem_id, setor_destino_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                            VALUES (?, ?, ?, ?, 'Ativo', ?, ?, NOW())`;

                        conn.query(queryHistNovo, [equipamento_reserva_id, eqNovo.setor_id, setor_destino_id, eqNovo.status, logDescricaoNovo, tecnico_nome || 'Técnico'], (errHistN) => {
                            if (errHistN) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistN.message }); });

                            if (chamado_id && chamado_id !== "0" && chamado_id !== "null") {
                                const queryUpdateChamado = `UPDATE chamados SET equipamento_id = ? WHERE id = ?`;
                                conn.query(queryUpdateChamado, [equipamento_reserva_id, chamado_id], (errChamado) => {
                                    if (errChamado) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errChamado.message }); });

                                    const msgHistOs = `[🔄 SUBSTITUIÇÃO/PERMUTA DE ATIVO] Equipamento anterior (Pat: ${eqAntigo.patrimonio}) substituído por novo equipamento (Pat: ${eqNovo.patrimonio}).`;
                                    const queryHistOs = `
                                        INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) 
                                        VALUES (?, ?, ?, 'Em Atendimento', NOW())`;

                                    conn.query(queryHistOs, [chamado_id, tecnico_nome || 'Técnico', msgHistOs], (errHistOs) => {
                                        if (errHistOs) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHistOs.message }); });

                                        conn.commit((errCommit) => {
                                            if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                            conn.release();
                                            res.json({ message: "Troca e logs de rastreabilidade gravados com sucesso!" });
                                        });
                                    });
                                });
                            } else {
                                conn.commit((errCommit) => {
                                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                    conn.release();
                                    res.json({ message: "Troca e logs de rastreabilidade gravados com sucesso!" });
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

// -------------------------------------------------------------------------
// GASES MEDICINAIS & MANIFOLD
// -------------------------------------------------------------------------

// Obter status do Manifold
app.get('/api/gases/manifold', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    db.query("SELECT * FROM gases_manifold WHERE id = 1", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.json({ id: 1, ramal_ativo: 'A', status_ramal_a: 'Em Uso', status_ramal_b: 'Cheio', capacidade_por_ramal: 12 });
        }
        res.json(results[0]);
    });
});

// Registrar a Virada do Manifold (Troca dos 12 cilindros)
app.post('/api/gases/manifold/virada', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { ramal_que_esvaziou, tecnico_nome, observacao } = req.body;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT * FROM gases_manifold WHERE id = 1 FOR UPDATE", (errMan, resMan) => {
            if (errMan || resMan.length === 0) {
                return conn.rollback(() => { conn.release(); res.status(500).json({ error: "Manifold não localizado." }); });
            }

            const manifold = resMan[0];
            const ramalAntigo = ramal_que_esvaziou || manifold.ramal_ativo;
            const novoRamalAtivo = ramalAntigo === 'A' ? 'B' : 'A';
            const qtdTroca = manifold.capacidade_por_ramal || 12;

            conn.query("SELECT id, quantidade_atual, valor_ultimo_cilindro FROM gases_estoque WHERE tipo_gas LIKE '%Oxigênio%' LIMIT 1", (errO2, resO2) => {
                if (errO2 || resO2.length === 0) {
                    return conn.rollback(() => { conn.release(); res.status(404).json({ error: "Estoque de Oxigênio não configurado." }); });
                }

                const estoqueO2 = resO2[0];
                if (estoqueO2.quantidade_atual < qtdTroca) {
                    return conn.rollback(() => {
                        conn.release();
                        res.status(400).json({ error: `Estoque insuficiente! Saldo na central: ${estoqueO2.quantidade_atual} un. Necessário: ${qtdTroca} un.` });
                    });
                }

                // Deduz 12 cilindros do estoque de oxigênio
                conn.query("UPDATE gases_estoque SET quantidade_atual = quantidade_atual - ? WHERE id = ?", [qtdTroca, estoqueO2.id], (errUpEst) => {
                    if (errUpEst) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpEst.message }); });

                    // Atualiza o estado do Manifold
                    const updateManifoldSql = `
                        UPDATE gases_manifold 
                        SET ramal_ativo = ?, 
                            status_ramal_a = CASE WHEN ? = 'A' THEN 'Em Uso' ELSE 'Cheio' END,
                            status_ramal_b = CASE WHEN ? = 'B' THEN 'Em Uso' ELSE 'Cheio' END,
                            data_ultima_virada = NOW(),
                            ultimo_tecnico = ?,
                            observacao = ?
                        WHERE id = 1
                    `;
                    conn.query(updateManifoldSql, [novoRamalAtivo, novoRamalAtivo, novoRamalAtivo, tecnico_nome || 'Técnico', observacao || `Virada de manifold para Ramal ${novoRamalAtivo}`], (errUpMan) => {
                        if (errUpMan) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUpMan.message }); });

                        // Grava no histórico de movimentações
                        const logVirada = `[VIRADA MANIFOLD] Ramal ${ramalAntigo} esvaziou. Ramal ${novoRamalAtivo} assumiu a rede. 12 cilindros novos instalados no Ramal ${ramalAntigo}. ${observacao ? `Obs: ${observacao}` : ''}`;
                        const queryHist = `
                            INSERT INTO gases_movimentacoes 
                            (tipo_gas_id, tipo_movimentacao, quantidade_cilindros, valor_unitario_cilindro, tecnico_responsavel, observacao, data_movimentacao)
                            VALUES (?, 'Saida', ?, ?, ?, ?, NOW())
                        `;
                        conn.query(queryHist, [estoqueO2.id, qtdTroca, estoqueO2.valor_ultimo_cilindro || 0, tecnico_nome || 'Técnico', logVirada], (errHist) => {
                            if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                            conn.commit((errCommit) => {
                                if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                conn.release();
                                res.json({ message: `Manifold virado para Ramal ${novoRamalAtivo} e 12 cilindros substituídos! 🔄🚰` });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Listar Gases e Saldo
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

// Cadastrar Novo Tipo de Gás
app.post('/api/gases', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { tipo_gas, capacidade_cilindro, estoque_minimo } = req.body;
    if (!tipo_gas || !capacidade_cilindro) {
        return res.status(400).json({ error: "O nome do gás e a capacidade são obrigatórios." });
    }

    const query = `INSERT INTO gases_estoque (tipo_gas, capacidade_cilindro, estoque_minimo, quantidade_atual) VALUES (?, ?, ?, 0)`;
    db.query(query, [tipo_gas.trim(), Number(capacidade_cilindro), Number(estoque_minimo || 5)], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Tipo de gás cadastrado!", id: result.insertId });
    });
});

// Registrar Compra / Entrada com Comprovante (Canhoto / NF)
app.post('/api/gases/entrada', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('comprovante_pdf'), (req, res) => {
    const { tipo_gas_id, quantidade_cilindros, valor_unitario_cilindro, tecnico_nome, observacao } = req.body;
    const qtd_entrada = Number(quantidade_cilindros || 0);
    const v_unitario = Number(valor_unitario_cilindro || 0);
    const url_comprovante = req.file ? `/uploads/${req.file.filename}` : null;

    if (!tipo_gas_id || qtd_entrada <= 0) {
        return res.status(400).json({ error: "Selecione o gás e informe a quantidade recebida." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE gases_estoque 
            SET quantidade_atual = quantidade_atual + ?, 
                valor_ultimo_cilindro = IF(? > 0, ?, valor_ultimo_cilindro) 
            WHERE id = ?
        `;
        conn.query(queryUpdate, [qtd_entrada, v_unitario, v_unitario, Number(tipo_gas_id)], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            const queryHist = `
                INSERT INTO gases_movimentacoes 
                (tipo_gas_id, tipo_movimentacao, quantidade_cilindros, valor_unitario_cilindro, tecnico_responsavel, observacao, url_comprovante, data_movimentacao) 
                VALUES (?, 'Entrada', ?, ?, ?, ?, ?, NOW())
            `;
            conn.query(queryHist, [Number(tipo_gas_id), qtd_entrada, v_unitario, tecnico_nome || 'Sistema', observacao || "Entrada de lote recebido do fornecedor.", url_comprovante], (errHist) => {
                if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.json({ message: "Compra de cilindros registrada com comprovante anexado! 🚚✅" });
                });
            });
        });
    });
});

// Registrar Consumo Avulso
app.post('/api/gases/consumo', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { tipo_gas_id, quantidade_cilindros, tecnico_nome, observacao } = req.body;
    const qtd_baixa = Number(quantidade_cilindros || 1);

    if (!tipo_gas_id) return res.status(400).json({ error: "Selecione o gás." });

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT quantidade_atual, valor_ultimo_cilindro FROM gases_estoque WHERE id = ?", [Number(tipo_gas_id)], (errCheck, results) => {
            if (errCheck || results.length === 0) {
                return conn.rollback(() => { conn.release(); res.status(404).json({ error: "Gás não localizado." }); });
            }

            const estoque = results[0];
            if (estoque.quantidade_atual < qtd_baixa) {
                return conn.rollback(() => { 
                    conn.release(); 
                    res.status(400).json({ error: `Estoque insuficiente! Saldo atual: ${estoque.quantidade_atual} cilindros.` }); 
                });
            }

            conn.query("UPDATE gases_estoque SET quantidade_atual = quantidade_atual - ? WHERE id = ?", [qtd_baixa, Number(tipo_gas_id)], (errUp) => {
                if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

                const queryHist = `
                    INSERT INTO gases_movimentacoes 
                    (tipo_gas_id, tipo_movimentacao, quantidade_cilindros, valor_unitario_cilindro, tecnico_responsavel, observacao, data_movimentacao) 
                    VALUES (?, 'Saida', ?, ?, ?, ?, NOW())
                `;
                conn.query(queryHist, [Number(tipo_gas_id), qtd_baixa, estoque.valor_ultimo_cilindro || 0, tecnico_nome || 'Técnico', observacao || "Troca individual de cilindro."], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Baixa de cilindro registrada com sucesso!" });
                    });
                });
            });
        });
    });
});

// Histórico de Movimentações
app.get('/api/gases/historico', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const query = `
        SELECT m.*, g.tipo_gas, g.capacidade_cilindro,
               (m.quantidade_cilindros * m.valor_unitario_cilindro) as custo_total_movimentacao
        FROM gases_movimentacoes m
        JOIN gases_estoque g ON m.tipo_gas_id = g.id
        ORDER BY m.data_movimentacao DESC
        LIMIT 100
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

// -------------------------------------------------------------------------
// SOLICITAÇÃO DE COMPRAS
// -------------------------------------------------------------------------
app.get('/api/solicitacoes-compra', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT 
            sc.*, 
            s.nome AS setor_nome, 
            f.nome_fantasia AS fornecedor_nome, 
            e.nome AS equipamento_nome, e.patrimonio AS equipamento_patrimonio,
            u.nome AS solicitante_nome,
            (SELECT COUNT(*) FROM solicitacoes_compra_itens sci WHERE sci.solicitacao_id = sc.id) AS total_itens,
            (SELECT IFNULL(SUM(sci.quantidade * sci.valor_estimado), 0) FROM solicitacoes_compra_itens sci WHERE sci.solicitacao_id = sc.id) AS valor_total_calculado
        FROM solicitacoes_compra sc
        LEFT JOIN setores s ON sc.setor_id = s.id
        LEFT JOIN fornecedores f ON sc.fornecedor_id = f.id
        LEFT JOIN equipamentos e ON sc.equipamento_id = e.id
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        ORDER BY sc.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.get('/api/solicitacoes-compra/:id', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { id } = req.params;

    const queryHeader = `
        SELECT 
            sc.*, 
            s.nome AS setor_nome, 
            f.nome_fantasia AS fornecedor_nome, f.cnpj AS fornecedor_cnpj, f.telefone AS fornecedor_telefone,
            e.nome AS equipamento_nome, e.patrimonio AS equipamento_patrimonio, e.modelo AS equipamento_modelo,
            u.nome AS solicitante_nome
        FROM solicitacoes_compra sc
        LEFT JOIN setores s ON sc.setor_id = s.id
        LEFT JOIN fornecedores f ON sc.fornecedor_id = f.id
        LEFT JOIN equipamentos e ON sc.equipamento_id = e.id
        LEFT JOIN usuarios u ON sc.solicitante_id = u.id
        WHERE sc.id = ?
    `;

    db.query(queryHeader, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Solicitação não encontrada." });

        const solicitacao = results[0];

        db.query("SELECT * FROM solicitacoes_compra_itens WHERE solicitacao_id = ?", [id], (errItens, itens) => {
            if (errItens) return res.status(500).json({ error: errItens.message });
            solicitacao.itens = itens || [];
            res.json(solicitacao);
        });
    });
});

app.post('/api/solicitacoes-compra', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const { setor_id, fornecedor_id, equipamento_id, solicitante_id, urgencia, motivo, itens } = req.body;

    if (!solicitante_id || !motivo || !itens || itens.length === 0) {
        return res.status(400).json({ error: "Preencha a justificativa e adicione ao menos 1 item na solicitação." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryHeader = `
            INSERT INTO solicitacoes_compra 
            (setor_id, fornecedor_id, equipamento_id, solicitante_id, urgencia, motivo, status, data_solicitacao) 
            VALUES (?, ?, ?, ?, ?, ?, 'Pendente', NOW())
        `;

        const v_setor = setor_id && setor_id !== "" ? Number(setor_id) : null;
        const v_fornecedor = fornecedor_id && fornecedor_id !== "" ? Number(fornecedor_id) : null;
        const v_equip = equipamento_id && equipamento_id !== "" ? Number(equipamento_id) : null;

        conn.query(queryHeader, [v_setor, v_fornecedor, v_equip, Number(solicitante_id), urgencia || 'Média', motivo], (errIns, resultIns) => {
            if (errIns) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errIns.message }); });

            const solicitacaoId = resultIns.insertId;

            const queryItem = `INSERT INTO solicitacoes_compra_itens (solicitacao_id, descricao, quantidade, valor_estimado) VALUES ?`;
            const valuesItens = itens.map(item => [
                solicitacaoId,
                item.descricao,
                Number(item.quantidade || 1),
                Number(item.valor_estimado || 0)
            ]);

            conn.query(queryItem, [valuesItens], (errItens) => {
                if (errItens) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errItens.message }); });

                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.status(201).json({ message: "Solicitação de compra gerada com sucesso!", id: solicitacaoId });
                });
            });
        });
    });
});

app.put('/api/solicitacoes-compra/:id', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { setor_id, fornecedor_id, equipamento_id, urgencia, motivo, itens } = req.body;

    if (!motivo || !itens || itens.length === 0) {
        return res.status(400).json({ error: "Informe o motivo e ao menos 1 item." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryHeader = `
            UPDATE solicitacoes_compra 
            SET setor_id = ?, fornecedor_id = ?, equipamento_id = ?, urgencia = ?, motivo = ?
            WHERE id = ?
        `;

        const v_setor = setor_id && setor_id !== "" ? Number(setor_id) : null;
        const v_fornecedor = fornecedor_id && fornecedor_id !== "" ? Number(fornecedor_id) : null;
        const v_equip = equipamento_id && equipamento_id !== "" ? Number(equipamento_id) : null;

        conn.query(queryHeader, [v_setor, v_fornecedor, v_equip, urgencia || 'Média', motivo, id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            conn.query("DELETE FROM solicitacoes_compra_itens WHERE solicitacao_id = ?", [id], (errDel) => {
                if (errDel) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errDel.message }); });

                const queryItem = `INSERT INTO solicitacoes_compra_itens (solicitacao_id, descricao, quantidade, valor_estimado) VALUES ?`;
                const valuesItens = itens.map(item => [
                    Number(id),
                    item.descricao,
                    Number(item.quantidade || 1),
                    Number(item.valor_estimado || 0)
                ]);

                conn.query(queryItem, [valuesItens], (errItens) => {
                    if (errItens) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errItens.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Solicitação atualizada com sucesso!" });
                    });
                });
            });
        });
    });
});

app.patch('/api/solicitacoes-compra/:id/status', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { status, usuario_id } = req.body;

    let query = `UPDATE solicitacoes_compra SET status = ?`;
    let params = [status];

    if (status === 'Financeiro') {
        query += `, user_financeiro_id = ?, data_financeiro = NOW()`;
        params.push(usuario_id);
    } else if (status === 'Diretoria' || status === 'Aprovado') {
        query += `, user_diretoria_id = ?, data_diretoria = NOW()`;
        params.push(usuario_id);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Status alterado para ${status} com sucesso!` });
    });
});

app.delete('/api/solicitacoes-compra/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("DELETE FROM solicitacoes_compra_itens WHERE solicitacao_id = ?", [id], (errItens) => {
            if (errItens) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errItens.message }); });

            conn.query("DELETE FROM solicitacoes_compra WHERE id = ?", [id], (errSol) => {
                if (errSol) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errSol.message }); });

                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.json({ message: "Solicitação excluída com sucesso!" });
                });
            });
        });
    });
});

// MANUTENÇÃO EXTERNA
app.post('/api/equipamentos/:id/saida-externa', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { fornecedor_id, tecnico_nome, descricao_motivo, data_previsao_retorno } = req.body;

    if (!fornecedor_id || !descricao_motivo) {
        return res.status(400).json({ error: "Selecione o fornecedor e informe o motivo da saída externa." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT nome_fantasia FROM fornecedores WHERE id = ?", [fornecedor_id], (errForn, resForn) => {
            if (errForn || resForn.length === 0) {
                return conn.rollback(() => { conn.release(); res.status(400).json({ error: "Fornecedor não localizado." }); });
            }

            const nomeFornecedor = resForn[0].nome_fantasia;
            const logTexto = `[SAÍDA EXTERNA] Enviado para ${nomeFornecedor}. Motivo: ${descricao_motivo}${data_previsao_retorno ? ` | Previsão Retorno: ${data_previsao_retorno}` : ''}`;

            conn.query("UPDATE equipamentos SET status = 'Em Manutenção' WHERE id = ?", [id], (errUp) => {
                if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

                const queryHist = `
                    INSERT INTO equipamentos_historico 
                    (equipamento_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                    SELECT id, status, 'Em Manutenção', ?, ?, NOW() 
                    FROM equipamentos WHERE id = ?
                `;

                conn.query(queryHist, [logTexto, tecnico_nome || 'Técnico', id], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Saída para manutenção externa registrada com sucesso!", fornecedor: nomeFornecedor });
                    });
                });
            });
        });
    });
});

app.post('/api/equipamentos/:id/retorno-externo', permitirApenas(['admin', 'coordenador', 'tecnico']), uploadDocumento.single('laudo_tecnico'), (req, res) => {
    const { id } = req.params;
    const { numero_nf, valor_servico, observacao, tecnico_nome } = req.body;

    const url_laudo = req.file ? `/uploads/${req.file.filename}` : null;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT status, setor_id FROM equipamentos WHERE id = ?", [id], (errEquip, resEquip) => {
            if (errEquip || resEquip.length === 0) {
                return conn.rollback(() => { conn.release(); res.status(404).json({ error: "Equipamento não localizado." }); });
            }

            const statusAnterior = resEquip[0].status;
            const setorAtual = resEquip[0].setor_id;
            const novoStatus = setorAtual ? 'Ativo' : 'Reserva';

            let logTexto = `[RETORNO MANUTENÇÃO EXTERNA] Equipamento reativado. Status: ${novoStatus}.`;
            if (numero_nf && numero_nf.trim() !== '') logTexto += ` NF/Recibo: ${numero_nf}.`;
            if (valor_servico && Number(valor_servico) > 0) logTexto += ` Valor do Serviço: R$ ${Number(valor_servico).toFixed(2)}.`;
            if (observacao && observacao.trim() !== '') logTexto += ` Parecer Técnico: ${observacao}`;

            conn.query("UPDATE equipamentos SET status = ? WHERE id = ?", [novoStatus, id], (errUp) => {
                if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

                const queryHist = `
                    INSERT INTO equipamentos_historico 
                    (equipamento_id, status_anterior, status_novo, descricao_log, tecnico_nome, data_movimentacao) 
                    VALUES (?, ?, ?, ?, ?, NOW())
                `;

                conn.query(queryHist, [id, statusAnterior, novoStatus, logTexto, tecnico_nome || 'Técnico'], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    if (url_laudo) {
                        const queryDoc = `
                            INSERT INTO documentos (nome_original, nome_armazenamento, url_arquivo, tipo_mimetype, equipamento_id, usuario_id) 
                            VALUES (?, ?, ?, ?, ?, 1)
                        `;
                        const valuesDoc = [
                            req.file.originalname,
                            req.file.filename,
                            url_laudo,
                            req.file.mimetype,
                            Number(id)
                        ];

                        conn.query(queryDoc, valuesDoc, (errDoc) => {
                            if (errDoc) console.error("⚠️ Aviso: Falha ao gravar laudo na tabela de documentos:", errDoc.message);

                            conn.commit((errCommit) => {
                                if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                                conn.release();
                                return res.json({ message: "Retorno de manutenção externa registrado com sucesso!" });
                            });
                        });
                    } else {
                        conn.commit((errCommit) => {
                            if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                            conn.release();
                            return res.json({ message: "Retorno de manutenção externa registrado com sucesso!" });
                        });
                    }
                });
            });
        });
    });
});

// INTEGRAÇÃO NOTAS FISCAIS -> ESTOQUE
app.post('/api/notas-fiscais/:id/itens', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const { item_id, nome, referencia, descricao, local_estoque_id, quantidade, valor_unitario } = req.body;

    const qtd_entrada = Number(quantidade || 0);
    const v_unitario = Number(valor_unitario || 0);

    if (!id || qtd_entrada <= 0) {
        return res.status(400).json({ error: "Informe a Nota Fiscal e uma quantidade válida maior que zero." });
    }

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT numero_nf FROM notas_fiscais WHERE id = ?", [id], (errNf, resNf) => {
            if (errNf || resNf.length === 0) {
                return conn.rollback(() => { 
                    conn.release(); 
                    res.status(404).json({ error: "Nota Fiscal não localizada no sistema." }); 
                });
            }

            const num_nota = resNf[0].numero_nf;

            const registrarEntradaEstoque = (idItemFinal) => {
                const queryHistEntrada = `
                    INSERT INTO itens_estoque_entradas 
                    (item_id, nota_fiscal_id, quantidade, valor_unitario, num_nota, data_entrada)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `;

                conn.query(queryHistEntrada, [idItemFinal, id, qtd_entrada, v_unitario, num_nota], (errHist) => {
                    if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                    conn.commit((errCommit) => {
                        if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                        conn.release();
                        res.json({ message: "Item e entrada no estoque lançados com sucesso! 📦🧾", item_id: idItemFinal });
                    });
                });
            };

            if (item_id && item_id !== "" && item_id !== "null") {
                const queryUpdateEstoque = `
                    UPDATE itens_estoque 
                    SET quantidade = quantidade + ?, 
                        valor_unitario = ?,
                        data_atualizacao = NOW()
                    WHERE id = ?
                `;

                conn.query(queryUpdateEstoque, [qtd_entrada, v_unitario, Number(item_id)], (errUp) => {
                    if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });
                    registrarEntradaEstoque(Number(item_id));
                });
            } else {
                if (!nome || nome.trim() === "") {
                    return conn.rollback(() => {
                        conn.release();
                        res.status(400).json({ error: "Informe o nome do novo insumo para cadastrá-lo no estoque." });
                    });
                }

                const ref_limpa = referencia && referencia.trim() !== "" ? referencia.trim() : null;
                const v_local_estoque = local_estoque_id && local_estoque_id !== "null" ? Number(local_estoque_id) : null;

                const queryNovoItem = `
                    INSERT INTO itens_estoque 
                    (nome, referencia, descricao, quantidade, valor_unitario, data_cadastro, data_atualizacao, local_estoque_id) 
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
                `;

                conn.query(queryNovoItem, [nome.trim(), ref_limpa, descricao || null, qtd_entrada, v_unitario, v_local_estoque], (errNovo, resNovo) => {
                    if (errNovo) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errNovo.message }); });
                    
                    const novoIdCriado = resNovo.insertId;
                    registrarEntradaEstoque(novoIdCriado);
                });
            }
        });
    });
});

app.get('/api/notas-fiscais/:id/itens', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT e.id, e.item_id, e.quantidade, e.valor_unitario, e.data_entrada, e.num_nota,
               i.nome as item_nome, i.referencia, (e.quantidade * e.valor_unitario) as valor_total_item
        FROM itens_estoque_entradas e
        JOIN itens_estoque i ON e.item_id = i.id
        WHERE e.nota_fiscal_id = ?
        ORDER BY e.data_entrada DESC
    `;

    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.get('/api/estoque/:id/historico-entradas', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT e.id, e.quantidade, e.valor_unitario, e.num_nota, e.data_entrada,
               nf.id as nota_id, nf.numero_nf, f.nome_fantasia as fornecedor_nome
        FROM itens_estoque_entradas e
        LEFT JOIN notas_fiscais nf ON e.nota_fiscal_id = nf.id
        LEFT JOIN fornecedores f ON nf.fornecedor_id = f.id
        WHERE e.item_id = ?
        ORDER BY e.data_entrada DESC
    `;

    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.put('/api/estoque/:id', permitirApenas(['admin', 'coordenador']), (req, res) => {
    const { id } = req.params;
    const { nome, referencia, descricao, valor_unitario, estoque_minimo, local_estoque_id } = req.body;

    const query = `
        UPDATE itens_estoque 
        SET nome = ?, referencia = ?, descricao = ?, valor_unitario = ?, estoque_minimo = ?, local_estoque_id = ?, data_atualizacao = NOW()
        WHERE id = ?
    `;
    const values = [
        nome.trim(), 
        referencia ? referencia.trim() : null, 
        descricao || null, 
        Number(valor_unitario || 0), 
        Number(estoque_minimo || 0), 
        local_estoque_id ? Number(local_estoque_id) : null, 
        id
    ];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Insumo atualizado com sucesso! 📦" });
    });
});

app.patch('/api/chamados/:id/reabrir', permitirApenas(['admin']), (req, res) => {
    const { id } = req.params;
    const { motivo_reabertura, usuario_nome } = req.body;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE chamados 
            SET status = 'Aberto', 
                data_conclusao = NULL 
            WHERE id = ?
        `;

        conn.query(queryUpdate, [id], (errUp) => {
            if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

            const logTexto = `[🔄 CHAMADO REABERTO PELO ADMINISTRADOR] Motivo: ${motivo_reabertura || 'Reabertura solicitada pela administração.'}`;
            const queryHist = `
                INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) 
                VALUES (?, ?, ?, 'Aberto', NOW())
            `;

            conn.query(queryHist, [id, usuario_nome || 'Administrador', logTexto], (errHist) => {
                if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

                conn.commit((errCommit) => {
                    if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
                    conn.release();
                    res.json({ message: "Chamado reaberto com sucesso!" });
                });
            });
        });
    });
});

app.post('/api/estoque/:id/entrada-rapida', permitirApenas(['admin', 'coordenador']), (req, res) => {
  const { id } = req.params;
  const { quantidade_adicionada, novo_valor_unitario, num_nota } = req.body;

  const qtdAdicionar = Number(quantidade_adicionada || 0);
  const valorUnitario = Number(novo_valor_unitario || 0);

  if (!id || qtdAdicionar <= 0) {
    return res.status(400).json({ error: "Informe uma quantidade válida maior que zero." });
  }

  db.beginTransaction((err, conn) => {
    if (err) return res.status(500).json({ error: err.message });

    const queryUpdate = `
      UPDATE itens_estoque 
      SET quantidade = quantidade + ?,
          valor_unitario = IF(? > 0, ?, valor_unitario),
          data_atualizacao = NOW()
      WHERE id = ?
    `;

    conn.query(queryUpdate, [qtdAdicionar, valorUnitario, valorUnitario, id], (errUp) => {
      if (errUp) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errUp.message }); });

      const queryHist = `
        INSERT INTO itens_estoque_entradas (item_id, quantidade, valor_unitario, num_nota, data_entrada)
        VALUES (?, ?, ?, ?, NOW())
      `;

      conn.query(queryHist, [id, qtdAdicionar, valorUnitario, num_nota || null], (errHist) => {
        if (errHist) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errHist.message }); });

        conn.commit((errCommit) => {
          if (errCommit) return conn.rollback(() => { conn.release(); res.status(500).json({ error: errCommit.message }); });
          conn.release();
          res.json({ message: "Estoque reabastecido com sucesso!" });
        });
      });
    });
  });
});

// -------------------------------------------------------------------------
// ROTAS DE EXPORTAÇÃO EXCEL (.XLSX)
// -------------------------------------------------------------------------

// 1. EXPORTAR CHAMADOS GERAIS
app.get('/api/relatorios/exportar/chamados', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id,
                c.data_abertura,
                c.data_conclusao,
                c.titulo,
                c.status,
                c.prioridade,
                c.categoria,
                c.tipo_manutencao,
                s.nome AS setor_nome,
                e.nome AS equipamento_nome,
                e.patrimonio AS equipamento_patrimonio,
                u.nome AS solicitante_nome,
                c.tecnico_responsavel,
                c.custo_servico
            FROM chamados c
            LEFT JOIN setores s ON c.setor_id = s.id
            LEFT JOIN equipamentos e ON c.equipamento_id = e.id
            LEFT JOIN usuarios u ON COALESCE(c.usuario_abertura_id, c.usuario_id) = u.id
            ORDER BY c.data_abertura DESC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Chamados');

            worksheet.columns = [
                { header: 'Nº OS', key: 'id', width: 10 },
                { header: 'Data Abertura', key: 'data_abertura', width: 20 },
                { header: 'Data Conclusão', key: 'data_conclusao', width: 20 },
                { header: 'Status', key: 'status', width: 16 },
                { header: 'Prioridade', key: 'prioridade', width: 14 },
                { header: 'Setor', key: 'setor_nome', width: 24 },
                { header: 'Equipamento', key: 'equipamento_nome', width: 28 },
                { header: 'Patrimônio', key: 'equipamento_patrimonio', width: 15 },
                { header: 'Assunto / Título', key: 'titulo', width: 35 },
                { header: 'Solicitante', key: 'solicitante_nome', width: 24 },
                { header: 'Técnico Responsável', key: 'tecnico_responsavel', width: 24 },
                { header: 'Custo (R$)', key: 'custo_servico', width: 15 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    id: row.id,
                    data_abertura: row.data_abertura ? new Date(row.data_abertura).toLocaleString('pt-BR') : '',
                    data_conclusao: row.data_conclusao ? new Date(row.data_conclusao).toLocaleString('pt-BR') : '',
                    status: row.status,
                    prioridade: row.prioridade,
                    setor_nome: row.setor_nome || 'Geral',
                    equipamento_nome: row.equipamento_nome || 'Nenhum',
                    equipamento_patrimonio: row.equipamento_patrimonio || 'S/P',
                    titulo: row.titulo,
                    solicitante_nome: row.solicitante_nome || 'Não informado',
                    tecnico_responsavel: row.tecnico_responsavel || 'Aguardando',
                    custo_servico: Number(row.custo_servico || 0).toFixed(2)
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=relatorio_chamados.xlsx');

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. EXPORTAR INVENTÁRIO PATRIMONIAL GERAL COM FILTROS DINÂMICOS
app.get('/api/relatorios/exportar/inventario-geral', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const { data_inicio, data_fim, setor_id, status, tipo_id, tipo_equipamento_id } = req.query;

        const inicio = data_inicio ? `${data_inicio} 00:00:00` : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
        const fim = data_fim ? `${data_fim} 23:59:59` : new Date().toISOString().split('T')[0] + ' 23:59:59';

        let queryParams = [inicio, fim, inicio, fim];
        let filtrosAdicionais = [];

        if (setor_id && setor_id !== 'todos') {
            filtrosAdicionais.push('e.setor_id = ?');
            queryParams.push(Number(setor_id));
        }

        if (status && status !== 'todos') {
            filtrosAdicionais.push('e.status = ?');
            queryParams.push(status);
        }

        const tipoFiltro = tipo_id || tipo_equipamento_id;
        if (tipoFiltro && tipoFiltro !== 'todos') {
            filtrosAdicionais.push('(e.tipo_id = ? OR e.tipo_equipamento_id = ?)');
            queryParams.push(Number(tipoFiltro), Number(tipoFiltro));
        }

        const clausulaWhere = filtrosAdicionais.length > 0 
            ? `WHERE ${filtrosAdicionais.join(' AND ')}` 
            : '';

        const query = `
            SELECT
                e.id, 
                e.patrimonio,
                e.nome, 
                e.fabricante as marca,
                e.modelo, 
                IFNULL(s.nome, 'Sem Setor') as setor_nome,
                IFNULL(t.nome, 'Sem Tipo') as tipo_nome,
                e.status,
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

        db.query(query, queryParams, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inventário Patrimonial');

            worksheet.columns = [
                { header: 'Patrimônio', key: 'patrimonio', width: 16 },
                { header: 'Equipamento', key: 'nome', width: 32 },
                { header: 'Marca / Fabricante', key: 'marca', width: 22 },
                { header: 'Modelo', key: 'modelo', width: 20 },
                { header: 'Tipo', key: 'tipo_nome', width: 20 },
                { header: 'Setor / Localização', key: 'setor_nome', width: 25 },
                { header: 'Status Atual', key: 'status', width: 16 },
                { header: 'Custo Acumulado (R$)', key: 'total_gasto', width: 22 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    patrimonio: row.patrimonio || '---',
                    nome: row.nome,
                    marca: row.marca || 'S/M',
                    modelo: row.modelo || 'S/M',
                    tipo_nome: row.tipo_nome || 'Sem Tipo',
                    setor_nome: row.setor_nome || 'Não definido',
                    status: row.status || 'Ativo',
                    total_gasto: Number(row.total_gasto || 0).toFixed(2)
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=inventario_geral_${data_inicio || 'inicio'}_a_${data_fim || 'fim'}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. EXPORTAR RELATÓRIO DE CHAMADOS POR SETOR
app.get('/api/relatorios/exportar/chamados-setor', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const { data_inicio, data_fim, setor_id } = req.query;

        const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const fim = data_fim || new Date().toISOString().split('T')[0];

        let queryParams = [inicio, fim];
        let filterSetor = '';

        if (setor_id && setor_id !== 'todos') {
            filterSetor = 'AND s.id = ?';
            queryParams.push(Number(setor_id));
        }

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
                s.caminho AS nome_setor,
                COUNT(c.id) AS total_chamados
            FROM ArvoreSetores s
            LEFT JOIN chamados c ON c.setor_id = s.id AND DATE(c.data_abertura) BETWEEN ? AND ?
            WHERE 1=1 ${filterSetor}
            GROUP BY s.id, s.caminho
            HAVING total_chamados > 0
            ORDER BY total_chamados DESC, s.caminho ASC
        `;

        db.query(sql, queryParams, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Chamados por Setor');

            worksheet.columns = [
                { header: 'Setor', key: 'nome_setor', width: 35 },
                { header: 'Total de Chamados', key: 'total_chamados', width: 20 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    nome_setor: row.nome_setor,
                    total_chamados: Number(row.total_chamados || 0)
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=chamados_por_setor_${inicio}_a_${fim}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. EXPORTAR ESTOQUE DE INSUMOS
app.get('/api/relatorios/exportar/estoque', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const query = `
            SELECT 
                ie.id,
                ie.referencia,
                ie.nome,
                ie.quantidade,
                ie.estoque_minimo,
                ie.valor_unitario,
                (ie.quantidade * ie.valor_unitario) AS valor_total_estoque,
                le.nome AS local_estoque_nome
            FROM itens_estoque ie
            LEFT JOIN locais_estoque le ON ie.local_estoque_id = le.id
            ORDER BY ie.nome ASC
        `;

        db.query(query, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Estoque de Insumos');

            worksheet.columns = [
                { header: 'ID', key: 'id', width: 8 },
                { header: 'Referência', key: 'referencia', width: 16 },
                { header: 'Nome da Peça / Insumo', key: 'nome', width: 35 },
                { header: 'Local de Estoque', key: 'local_estoque_nome', width: 22 },
                { header: 'Saldo Atual', key: 'quantidade', width: 14 },
                { header: 'Qtd Mínima', key: 'estoque_minimo', width: 14 },
                { header: 'Valor Unit. (R$)', key: 'valor_unitario', width: 16 },
                { header: 'Valor Total (R$)', key: 'valor_total_estoque', width: 18 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    id: row.id,
                    referencia: row.referencia || '---',
                    nome: row.nome,
                    local_estoque_nome: row.local_estoque_nome || 'Geral',
                    quantidade: row.quantidade,
                    estoque_minimo: row.estoque_minimo || 0,
                    valor_unitario: Number(row.valor_unitario || 0).toFixed(2),
                    valor_total_estoque: Number(row.valor_total_estoque || 0).toFixed(2)
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=estoque_insumos.xlsx');

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR RELATÓRIO DE TROCAS DE FILTROS DE ÁGUA (.XLSX)
app.get('/api/relatorios/exportar/filtros', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
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

        db.query(query, [inicio, fim], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Trocas de Filtros');

            worksheet.columns = [
                { header: 'Data da Troca', key: 'data_troca', width: 18 },
                { header: 'Ponto / Local', key: 'filtro_nome', width: 30 },
                { header: 'Setor', key: 'setor_nome', width: 25 },
                { header: 'Insumo Utilizado', key: 'insumo', width: 30 },
                { header: 'Responsável Técnico', key: 'tecnico_nome', width: 25 },
                { header: 'Laudo / Observações', key: 'observacao', width: 45 },
                { header: 'Custo Médio (R$)', key: 'custo', width: 18 }
            ];

            // Cabeçalho estilizado em azul ardósia escuro
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                let insumo = 'Nenhum insumo baixado';
                let obsLimpa = row.obs_intervencao || '';
                let custo = '0.00';

                if (row.obs_intervencao && row.obs_intervencao.includes('Peça Deduzida:')) {
                    try {
                        const trecho = row.obs_intervencao.split('Peça Deduzida:')[1];
                        insumo = trecho.split('|')[0].replace(']', '').trim();
                    } catch {}
                }

                if (row.obs_intervencao && row.obs_intervencao.includes('[')) {
                    obsLimpa = row.obs_intervencao.split('[')[0].trim();
                }

                if (row.obs_intervencao && row.obs_intervencao.includes('Custo Médio: R$')) {
                    try {
                        const partes = row.obs_intervencao.split('Custo Médio: R$');
                        if (partes[1]) {
                            custo = parseFloat(partes[1].replace(']', '').trim()).toFixed(2);
                        }
                    } catch {}
                }

                worksheet.addRow({
                    data_troca: row.data_troca ? new Date(row.data_troca).toLocaleDateString('pt-BR') : '',
                    filtro_nome: row.filtro_nome,
                    setor_nome: row.setor_nome || 'Não Informado',
                    insumo: insumo,
                    tecnico_nome: row.tecnico_nome,
                    observacao: obsLimpa,
                    custo: custo
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=relatorio_filtros_${data_inicio}_a_${data_fim}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR RELATÓRIO CONSOLIDADO DE ESTOQUE POR LOCAL (.XLSX)
app.get('/api/relatorios/exportar/estoque-local', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const { local_estoque_id, data_inicio, data_fim, tipo_registro } = req.query;

        let query = `
            SELECT * FROM (
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
                
                SELECT 
                    e.id, 
                    CONCAT(e.nome, ' (S/N: ', IFNULL(e.num_serie, 'N/A'), ')') AS nome,
                    IFNULL(e.patrimonio, 'S/Patrimônio') AS referencia, 
                    1 AS quantidade, 
                    0.00 AS valor_unitario, 
                    IFNULL(e.data_ultima_preventiva, CURDATE()) AS data_cadastro,
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

        if (local_estoque_id && local_estoque_id !== 'todos') {
            query += ` AND local_estoque_id = ?`;
            queryParams.push(Number(local_estoque_id));
        }

        if (tipo_registro && tipo_registro !== 'todos') {
            query += ` AND tipo_registro = ?`;
            queryParams.push(tipo_registro);
        }

        if (data_inicio && data_fim) {
            query += ` AND data_cadastro BETWEEN ? AND ?`;
            queryParams.push(`${data_inicio} 00:00:00`, `${data_fim} 23:59:59`);
        }

        query += ` ORDER BY nome_estoque ASC, tipo_registro DESC, nome ASC`;

        db.query(query, queryParams, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Balanço de Estoque');

            worksheet.columns = [
                { header: 'Descrição / Especificação', key: 'nome', width: 35 },
                { header: 'Tipo', key: 'tipo_registro', width: 16 },
                { header: 'Origem / Estoque', key: 'nome_estoque', width: 25 },
                { header: 'Ref / Patrimônio', key: 'referencia', width: 20 },
                { header: 'Qtd', key: 'quantidade', width: 12 },
                { header: 'Preço Unit. (R$)', key: 'valor_unitario', width: 18 },
                { header: 'Subtotal (R$)', key: 'subtotal', width: 18 },
                { header: 'Detalhes / Observações', key: 'descricao', width: 40 }
            ];

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                const subtotal = Number(row.quantidade || 0) * Number(row.valor_unitario || 0);
                worksheet.addRow({
                    nome: row.nome,
                    tipo_registro: row.tipo_registro,
                    nome_estoque: row.nome_estoque,
                    referencia: row.referencia,
                    quantidade: Number(row.quantidade || 0),
                    valor_unitario: Number(row.valor_unitario || 0).toFixed(2),
                    subtotal: subtotal.toFixed(2),
                    descricao: row.descricao
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=balanco_estoque_local_${data_inicio || 'inicio'}_a_${data_fim || 'fim'}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EXPORTAR RELATÓRIO DE CUSTOS POR SETOR (.XLSX)
app.get('/api/relatorios/exportar/custos-setor', permitirApenas(['admin', 'coordenador']), async (req, res) => {
    try {
        const { data_inicio, data_fim, setor_id } = req.query;

        const inicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
        const fim = data_fim || new Date().toISOString().split('T')[0] + ' 23:59:59';

        let queryParams = [inicio, fim];
        let filterSetor = '';

        if (setor_id && setor_id !== 'todos') {
            filterSetor = 'AND s.id = ?';
            queryParams.push(setor_id);
        }

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
                s.caminho AS nome_setor,
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

        db.query(sql, queryParams, async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Custos por Setor');

            worksheet.columns = [
                { header: 'Setor Hospitalar', key: 'nome_setor', width: 35 },
                { header: 'Nº Chamados (OS)', key: 'total_chamados', width: 18 },
                { header: 'Custos de Serviços (R$)', key: 'total_custo_servico', width: 22 },
                { header: 'Custos de Peças (R$)', key: 'total_custo_pecas', width: 20 },
                { header: 'Total Acumulado (R$)', key: 'custo_total_geral', width: 22 }
            ];

            // Cabeçalho estilizado em azul escuro
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            results.forEach(row => {
                worksheet.addRow({
                    nome_setor: row.nome_setor,
                    total_chamados: Number(row.total_chamados || 0),
                    total_custo_servico: Number(row.total_custo_servico || 0).toFixed(2),
                    total_custo_pecas: Number(row.total_custo_pecas || 0).toFixed(2),
                    custo_total_geral: Number(row.custo_total_geral || 0).toFixed(2)
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=custos_por_setor_${data_inicio || 'inicio'}_a_${data_fim || 'fim'}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =========================================================================
// MÓDULO: MANUTENÇÃO PLANEJADA (PREVENTIVAS / CORRETIVAS PROGRAMADAS)
// =========================================================================

// 1. Listar todas as manutenções planejadas
app.get('/api/manutencoes-planejadas', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT 
            mp.*,
            e.nome AS equipamento_nome,
            e.patrimonio AS equipamento_patrimonio,
            s.nome AS setor_nome,
            u.nome AS tecnico_nome,
            f.nome_fantasia AS fornecedor_nome
        FROM manutencoes_planejadas mp
        LEFT JOIN equipamentos e ON e.id = mp.equipamento_id
        LEFT JOIN setores s ON s.id = mp.setor_id
        LEFT JOIN usuarios u ON u.id = mp.tecnico_id
        LEFT JOIN fornecedores f ON f.id = mp.fornecedor_id
        ORDER BY mp.data_programada ASC, mp.hora_programada ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Erro ao listar manutenções planejadas:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results || []);
    });
});

// 2. Alertas do dia (Hoje ou Atrasadas pendentes de execução)
app.get('/api/manutencoes-planejadas/alertas-hoje', permitirApenas(['admin', 'coordenador', 'tecnico', 'usuario']), (req, res) => {
    const query = `
        SELECT 
            mp.*,
            e.nome AS equipamento_nome,
            e.patrimonio AS equipamento_patrimonio,
            s.nome AS setor_nome,
            u.nome AS tecnico_nome,
            f.nome_fantasia AS fornecedor_nome
        FROM manutencoes_planejadas mp
        LEFT JOIN equipamentos e ON e.id = mp.equipamento_id
        LEFT JOIN setores s ON s.id = mp.setor_id
        LEFT JOIN usuarios u ON u.id = mp.tecnico_id
        LEFT JOIN fornecedores f ON f.id = mp.fornecedor_id
        WHERE mp.status = 'Agendado'
          AND mp.data_programada <= CURDATE()
        ORDER BY mp.data_programada ASC, mp.hora_programada ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Erro ao buscar alertas de manutenções planejadas:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results || []);
    });
});

// 3. Cadastrar novo planejamento
app.post('/api/manutencoes-planejadas', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const {
        titulo,
        descricao_planejamento,
        tipo,
        equipamento_id,
        setor_id,
        chamado_origem_id,
        data_programada,
        hora_programada,
        motivo_janela,
        prioridade,
        tipo_responsavel,
        tecnico_id,
        fornecedor_id,
        criado_por_nome
    } = req.body;

    if (!titulo || !descricao_planejamento || !data_programada) {
        return res.status(400).json({ error: "Título, detalhamento e data programada são obrigatórios." });
    }

    const v_equip = equipamento_id && equipamento_id !== "" && equipamento_id !== "null" ? Number(equipamento_id) : null;
    const v_setor = setor_id && setor_id !== "" && setor_id !== "null" ? Number(setor_id) : null;
    const v_chamado_origem = chamado_origem_id && chamado_origem_id !== "" && chamado_origem_id !== "null" ? Number(chamado_origem_id) : null;
    const v_tecnico = tecnico_id && tecnico_id !== "" && tecnico_id !== "null" ? Number(tecnico_id) : null;
    const v_fornecedor = fornecedor_id && fornecedor_id !== "" && fornecedor_id !== "null" ? Number(fornecedor_id) : null;

    const query = `
        INSERT INTO manutencoes_planejadas (
            titulo, descricao_planejamento, tipo, equipamento_id, setor_id,
            chamado_origem_id, data_programada, hora_programada, motivo_janela,
            prioridade, tipo_responsavel, tecnico_id, fornecedor_id, criado_por_nome, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Agendado')
    `;

    const values = [
        titulo.trim(),
        descricao_planejamento,
        tipo || 'Corretiva Programada',
        v_equip,
        v_setor,
        v_chamado_origem,
        data_programada,
        hora_programada || null,
        motivo_janela || null,
        prioridade || 'Média',
        tipo_responsavel || 'Interno',
        v_tecnico,
        v_fornecedor,
        criado_por_nome || 'Sistema'
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Erro ao cadastrar manutenção planejada:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Manutenção planejada cadastrada com sucesso! 📅✅", id: result.insertId });
    });
});

// 4. Iniciar Execução (Converte Planejamento em OS / Chamado ativo)
app.post('/api/manutencoes-planejadas/:id/gerar-os', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    db.beginTransaction((err, conn) => {
        if (err) return res.status(500).json({ error: err.message });

        conn.query("SELECT * FROM manutencoes_planejadas WHERE id = ?", [id], (errPlano, resPlano) => {
            if (errPlano || resPlano.length === 0) {
                return conn.rollback(() => {
                    conn.release();
                    res.status(404).json({ error: "Planejamento não encontrado." });
                });
            }

            const plano = resPlano[0];
            const descProblema = `[MANUTENÇÃO PLANEJADA #${plano.id}]\n${plano.descricao_planejamento}\n\nJanela / Motivo Operacional: ${plano.motivo_janela || 'Nenhum'}`;
            const tipoChamado = plano.tipo === 'Preventiva' ? 'Preventiva' : 'Corretiva';

            const sqlInsertOS = `
                INSERT INTO chamados (
                    setor_id, equipamento_id, titulo, descricao_problema,
                    prioridade, categoria, status, data_abertura, usuario_abertura_id,
                    tipo_manutencao, tipo_atendimento, tecnico_id, fornecedor_id
                ) VALUES (?, ?, ?, ?, ?, 'Manutenção', 'Em Atendimento', NOW(), ?, ?, ?, ?, ?)
            `;

            const valuesOS = [
                plano.setor_id,
                plano.equipamento_id,
                `[Planejada] ${plano.titulo}`,
                descProblema,
                plano.prioridade || 'Média',
                Number(usuario_id || 1),
                tipoChamado,
                plano.tipo_responsavel || 'Interno',
                plano.tecnico_id,
                plano.fornecedor_id
            ];

            conn.query(sqlInsertOS, valuesOS, (errOS, resOS) => {
                if (errOS) {
                    return conn.rollback(() => {
                        conn.release();
                        console.error("❌ Erro ao criar chamado da planejada:", errOS.message);
                        res.status(500).json({ error: errOS.message });
                    });
                }

                const novoChamadoId = resOS.insertId;

                const sqlUpdatePlano = `
                    UPDATE manutencoes_planejadas 
                    SET status = 'Em Andamento', chamado_execucao_id = ? 
                    WHERE id = ?
                `;

                conn.query(sqlUpdatePlano, [novoChamadoId, id], (errUp) => {
                    if (errUp) {
                        return conn.rollback(() => {
                            conn.release();
                            res.status(500).json({ error: errUp.message });
                        });
                    }

                    conn.commit((errCommit) => {
                        if (errCommit) {
                            return conn.rollback(() => {
                                conn.release();
                                res.status(500).json({ error: errCommit.message });
                            });
                        }
                        conn.release();
                        res.json({ message: "Ordem de Serviço gerada com sucesso!", chamado_id: novoChamadoId });
                    });
                });
            });
        });
    });
});

// 5. Cancelar ou Concluir Planejamento diretamente
app.patch('/api/manutencoes-planejadas/:id/status', permitirApenas(['admin', 'coordenador', 'tecnico']), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['Agendado', 'Em Andamento', 'Concluído', 'Cancelado'];
    if (!statusValidos.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
    }

    const query = `UPDATE manutencoes_planejadas SET status = ? WHERE id = ?`;
    db.query(query, [status, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Planejamento alterado para ${status} com sucesso!` });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));