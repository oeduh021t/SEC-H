require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcrypt');
const multer = require('multer'); // ADICIONADO
const path = require('path');   // ADICIONADO
const saltRounds = 10;

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DE UPLOADS (FOTOS) ---
// Torna a pasta 'uploads' acessível via URL (Ex: http://ip:3000/uploads/foto.jpg)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Nome único: timestamp-aleatorio.extensao
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

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
// DASHBOARD
// -------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
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
        recentes: "SELECT id, titulo, status, data_abertura FROM chamados ORDER BY id DESC LIMIT 6"
    };

    const promises = Object.keys(queries).map(key => {
        return new Promise((resolve, reject) => {
            db.query(queries[key], (err, results) => {
                if (err) reject(err);
                else resolve({ key, data: results });
            });
        });
    });

    Promise.all(promises)
        .then(results => {
            const stats = {};
            results.forEach(r => { stats[r.key] = r.data; });
            res.json(stats);
        })
        .catch(err => res.status(500).json(err));
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
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva } = req.body;
    const query = `INSERT INTO equipamentos (nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, data_ultima_preventiva) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`;
    const values = [nome || 'Sem Nome', modelo || null, patrimonio || 'S/P', num_serie || null, fabricante || null, setor_id || null, status || 'Ativo', tipo_id || null, periodicidade_preventiva || 0];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sucesso!", id: result.insertId });
    });
});

app.put('/api/equipamentos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva } = req.body;
    const query = `UPDATE equipamentos SET nome=?, modelo=?, patrimonio=?, num_serie=?, fabricante=?, setor_id=?, status=?, tipo_id=?, periodicidade_preventiva=? WHERE id=?`;
    const values = [nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva, id];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Dados atualizados!" });
    });
});

app.delete('/api/equipamentos/:id', (req, res) => {
    const { id } = req.params;
    db.query(`DELETE FROM equipamentos WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Removido com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE CHAMADOS / OS
// -------------------------------------------------------------------------

app.get('/api/chamados', (req, res) => {
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
            c.data_abertura DESC
    `;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

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
        if (results.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });

        const chamado = results[0];
        const queryHist = `SELECT * FROM chamados_historico WHERE chamado_id = ? ORDER BY data_registro DESC`;
        db.query(queryHist, [id], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            chamado.historico = logs || [];
            res.json(chamado);
        });
    });
});

// ABRIR CHAMADO (MODIFICADO PARA FOTO)
app.post('/api/chamados', upload.single('foto'), (req, res) => {
    const { setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao } = req.body;
    const foto_abertura = req.file ? `/uploads/${req.file.filename}` : null;

    const query = `INSERT INTO chamados (setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao, foto_abertura, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [setor_id || null, equipamento_id || null, titulo, descricao_problema, prioridade || 'Média', categoria || 'Manutenção', tipo_manutencao || 'Corretiva', foto_abertura];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        enviarTelegram(`🚨 *NOVA OS #${result.insertId}*\n📝 *Assunto:* ${titulo}`);
        res.json({ message: "Chamado aberto!", id: result.insertId });
    });
});

// FINALIZAR CHAMADO (MODIFICADO PARA FOTO)
app.patch('/api/chamados/:id/finalizar', upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { status, tecnico_responsavel, descricao_solucao, tipo_atendimento } = req.body;
    const foto_conclusao = req.file ? `/uploads/${req.file.filename}` : null;

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        const queryUpdate = `
            UPDATE chamados
            SET status = ?, tecnico_responsavel = ?, descricao_solucao = ?, tipo_atendimento = ?,
                foto_conclusao = COALESCE(?, foto_conclusao),
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;

        db.query(queryUpdate, [status, tecnico_responsavel, descricao_solucao, tipo_atendimento, foto_conclusao, status, id], (err) => {
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

app.patch('/api/chamados/:id/observacao', (req, res) => {
    const { id } = req.params;
    const { nova_obs, usuario_nome, usuario_nivel } = req.body;

    // 1. Bloqueio de Segurança: Apenas Admin ou Coordenador
    const niveisPermitidos = ['admin', 'coordenador', 'Coordenador', 'Admin'];
    if (!niveisPermitidos.includes(usuario_nivel)) {
        return res.status(403).json({ error: "Acesso negado: Apenas gestores podem adicionar notas." });
    }

    // 2. Montagem do Carimbo com dados dinâmicos
    const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const carimbo = `\n\n--- ${data} (${usuario_nome} | ${usuario_nivel}) ---\n${nova_obs}`;

    const query = `UPDATE chamados SET observacao_coordenador = CONCAT(COALESCE(observacao_coordenador, ''), ?) WHERE id = ?`;
    
    db.query(query, [carimbo, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Nota adicionada com sucesso!" });
    });
});

// -------------------------------------------------------------------------
// ROTAS DE PREVENTIVAS
// -------------------------------------------------------------------------

app.get('/api/preventivas', (req, res) => {
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

app.post('/api/preventivas/baixa', (req, res) => {
    const { equipamento_id, relatorio_tecnico, tecnico_nome } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);
        db.query("UPDATE equipamentos SET data_ultima_preventiva = CURDATE() WHERE id = ?", [equipamento_id], (err) => {
            if (err) return db.rollback(() => res.status(500).json(err));
            const historicoTexto = `[ID EQUIP: ${equipamento_id}] RELATÓRIO DE PREVENTIVA: ${relatorio_tecnico}`;
            const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (NULL, ?, ?, 'Preventiva Realizada', NOW())";
            db.query(queryHist, [tecnico_nome || 'Técnico', historicoTexto], (err) => {
                if (err) return db.rollback(() => res.status(500).json(err));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json(err));
                    res.json({ message: "Baixa de preventiva registrada!" });
                });
            });
        });
    });
});

// -------------------------------------------------------------------------
// PRONTUÁRIO
// -------------------------------------------------------------------------

app.get('/api/equipamentos/:id/prontuario', (req, res) => {
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

app.get('/api/usuarios', (req, res) => {
    db.query("SELECT id, nome, login, nivel FROM usuarios ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post('/api/usuarios', async (req, res) => {
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

app.put('/api/usuarios/:id', async (req, res) => {
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

app.delete('/api/usuarios/:id', (req, res) => {
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

        // O bcrypt.compare é inteligente o suficiente para ler qualquer hash 
        // (tanto o $2y do PHP/GLPI quanto o $2b do Node.js)
        const senhaCorreta = await bcrypt.compare(senha, user.senha);

        if (senhaCorreta) {
            res.json({ id: user.id, nome: user.nome, nivel: user.nivel });
        } else {
            res.status(401).json({ error: "Senha incorreta" });
        }
    });
});

// ROTA PARA O PRÓPRIO USUÁRIO ALTERAR SUA SENHA
app.patch('/api/usuarios/alterar-senha', async (req, res) => {
    const { id, senhaAtual, novaSenha } = req.body;

    if (!id || !senhaAtual || !novaSenha) {
        return res.status(400).json({ error: "Preencha todos os campos." });
    }

    // 1. Busca a senha atual no banco
    db.query("SELECT senha FROM usuarios WHERE id = ?", [id], async (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Usuário não encontrado." });

        const hashBanco = results[0].senha;

        try {
            // 2. Verifica se a senha atual digitada bate com a do banco
            const senhaOk = await bcrypt.compare(senhaAtual, hashBanco);

            if (!senhaOk) {
                return res.status(401).json({ error: "A senha atual está incorreta." });
            }

            // 3. Se estiver ok, gera o novo hash e salva
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

// ROTA DE INVENTÁRIO GERAL (COM CUSTOS ACUMULADOS)
app.get('/api/relatorios/inventario-geral', (req, res) => {
    const query = `
        SELECT 
            e.id, e.nome, e.modelo, e.patrimonio, e.fabricante as marca, e.status,
            IFNULL(s.nome, 'Sem Setor') as setor_nome, 
            IFNULL(t.nome, 'Sem Tipo') as tipo_nome,
            IFNULL(SUM(c.custo_servico), 0) as total_gasto
        FROM equipamentos e 
        LEFT JOIN setores s ON e.setor_id = s.id 
        LEFT JOIN tipos_equipamentos t ON e.tipo_id = t.id 
        LEFT JOIN chamados c ON e.id = c.equipamento_id AND c.status = 'Concluído'
        GROUP BY e.id
        ORDER BY s.nome ASC, e.nome ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// -------------------------------------------------------------------------
// AUXILIARES
// -------------------------------------------------------------------------

app.get('/api/setores', (req, res) => {
    const query = `SELECT s1.id, TRIM(LEADING ' > ' FROM CONCAT_WS(' > ', s3.nome, s2.nome, s1.nome)) as nome
                    FROM setores s1 LEFT JOIN setores s2 ON s1.setor_pai_id = s2.id LEFT JOIN setores s3 ON s2.setor_pai_id = s3.id
                    ORDER BY s3.nome, s2.nome, s1.nome ASC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.get('/api/tipos_equipamentos', (req, res) => {
    db.query(`SELECT * FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));
