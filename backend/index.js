require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------------
// CONFIGURAÇÃO DO BANCO DE DADOS
// -------------------------------------------------------------------------
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('❌ Erro crítico ao conectar ao banco:', err.message);
        return;
    }
    console.log('✅ Conectado ao MySQL com sucesso!');
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
        await axios.post(url, {
            chat_id: chat_id,
            text: mensagem,
            parse_mode: 'Markdown'
        });
        console.log("✅ Notificação enviada ao Telegram");
    } catch (err) {
        console.error("❌ Erro ao enviar Telegram:", err.message);
    }
};
// -------------------------------------------------------------------------
// ROTAS DE EQUIPAMENTOS
// -------------------------------------------------------------------------
app.get('/api/equipamentos', (req, res) => {
    const query = `SELECT e.*, s.nome as setor_nome FROM equipamentos e LEFT JOIN setores s ON e.setor_id = s.id ORDER BY e.id DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.post('/api/equipamentos', (req, res) => {
    const { nome, modelo, patrimonio, num_serie, tipo_id, setor_id, status } = req.body;
    const query = `INSERT INTO equipamentos (nome, modelo, patrimonio, num_serie, tipo_id, setor_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(query, [nome, modelo, patrimonio, num_serie, tipo_id, setor_id, status || 'Ativo'], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sucesso!", id: result.insertId });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE CHAMADOS / OS
// -------------------------------------------------------------------------

// Listar todos os chamados
app.get('/api/chamados', (req, res) => {
    const query = `
        SELECT c.*, s.nome as setor_nome, e.nome as equip_nome, e.patrimonio as equip_pat
        FROM chamados c
        LEFT JOIN setores s ON c.setor_id = s.id
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        ORDER BY FIELD(c.status, 'Aberto', 'Em Atendimento', 'Concluído'), c.data_abertura DESC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// Buscar um chamado específico + Histórico
app.get('/api/chamados/:id', (req, res) => {
    const { id } = req.params;
    const queryChamado = `
        SELECT c.*, e.patrimonio, e.nome as eq_nome, s.nome as setor_nome
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN setores s ON c.setor_id = s.id
        WHERE c.id = ?
    `;

    db.query(queryChamado, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Não encontrado" });

        const queryHist = `SELECT * FROM chamados_historico WHERE chamado_id = ? ORDER BY data_registro DESC`;
        db.query(queryHist, [id], (err, logs) => {
            const chamado = results[0];
            chamado.historico = logs || [];
            res.json(chamado);
        });
    });
});

// Abrir novo chamado
app.post('/api/chamados', (req, res) => {
    const { setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria } = req.body;
    const query = `INSERT INTO chamados (setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [setor_id || null, equipamento_id || null, titulo, descricao_problema, prioridade || 'Média', categoria || 'Manutenção'];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        enviarTelegram(`🚨 *NOVA OS #${result.insertId}*\n🏥 *Local:* ${setor_id}\n📝 *Assunto:* ${titulo}`);
        res.json({ message: "Chamado aberto!", id: result.insertId });
    });
});

// FINALIZAR / ATENDER + GRAVAR HISTÓRICO (Lógica consolidada)
app.patch('/api/chamados/:id/finalizar', (req, res) => {
    const { id } = req.params;
    const { status, tecnico_responsavel, descricao_solucao, tipo_atendimento } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        const queryUpdate = `
            UPDATE chamados 
            SET status = ?, tecnico_responsavel = ?, descricao_solucao = ?, tipo_atendimento = ?, 
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao) 
            WHERE id = ?
        `;
        
        db.query(queryUpdate, [status, tecnico_responsavel, descricao_solucao, tipo_atendimento, status, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json(err));

            const queryHist = `
                INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro)
                VALUES (?, ?, ?, ?, NOW())
            `;
            const msgHist = descricao_solucao || `Status alterado para ${status}`;
            
            db.query(queryHist, [id, tecnico_responsavel, msgHist, status], (err) => {
                if (err) return db.rollback(() => res.status(500).json(err));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json(err));
                    res.json({ message: "Sucesso!" });
                });
            });
        });
    });
});

// Observação do coordenador
app.patch('/api/chamados/:id/observacao', (req, res) => {
    const { id } = req.params;
    const { nova_obs } = req.body;
    const usuario = "Eduardo Nascimento";
    const data = new Date().toLocaleString('pt-BR');
    const carimbo = `\n\n--- ${data} (${usuario}) ---\n${nova_obs}`;

    const query = `UPDATE chamados SET observacao_coordenador = CONCAT(COALESCE(observacao_coordenador, ''), ?) WHERE id = ?`;
    db.query(query, [carimbo, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Nota adicionada!" });
    });
});

// Setores
app.get('/api/setores', (req, res) => {
    const query = `SELECT s1.id, TRIM(LEADING ' > ' FROM CONCAT_WS(' > ', s3.nome, s2.nome, s1.nome)) as nome FROM setores s1 LEFT JOIN setores s2 ON s1.setor_pai_id = s2.id LEFT JOIN setores s3 ON s2.setor_pai_id = s3.id ORDER BY s3.nome, s2.nome, s1.nome ASC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));
