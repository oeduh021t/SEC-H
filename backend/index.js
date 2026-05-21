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
app.use(cors());

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
        await axios.post(url, { chat_id, text: message = mensagem, parse_mode: 'Markdown' });
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

// PUT: Editar Equipamento com tratamento de dados e suporte a foto
app.put('/api/equipamentos/:id', upload.single('foto_equipamento'), (req, res) => {
    const { id } = req.params;
    const { nome, modelo, patrimonio, num_serie, fabricante, setor_id, status, tipo_id, periodicidade_preventiva } = req.body;
    
    // TRATAMENTO CRÍTICO: Evita o erro 500 convertendo strings vazias do FormData em NULL para o MySQL
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

    // Se o técnico enviou uma nova foto, atualiza o caminho. Caso contrário, não mexe no campo da foto.
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
        res.json({ message: "Dados atualizados com sucesso!" });
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
            c.data_abertura DESC`;
    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.get('/api/chamados/:id', (req, res) => {
    const { id } = req.params;

    const queryChamado = `
        SELECT c.*, e.patrimonio, e.num_serie, e.nome as eq_nome, e.foto_equipamento, s.nome as setor_nome,
               f.nome_fantasia as empresa_terceirizada, c.assinatura_tecnico, c.assinatura_setor
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

app.post('/api/chamados', upload.single('foto'), (req, res) => {
    const { setor_id, equipamento_id, titulo, descricao_problema, prioridade, category, categoria, tipo_manutencao } = req.body;
    const foto_abertura = req.file ? `/uploads/${req.file.filename}` : null;

    const categoriaFinal = categoria || category || 'Manutenção';

    const query = `INSERT INTO chamados (setor_id, equipamento_id, titulo, descricao_problema, prioridade, categoria, tipo_manutencao, foto_abertura, status, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())`;
    const values = [setor_id || null, equipamento_id || null, titulo, descricao_problema, prioridade || 'Média', categoriaFinal, tipo_manutencao || 'Corretiva', foto_abertura];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const novaOsId = result.insertId;

        const queryDadosTelegram = `
            SELECT c.id, c.titulo, DATE_FORMAT(c.data_abertura, '%d/%m/%Y às %H:%i') as hora_formatada, s.nome as setor_nome
            FROM chamados c
            LEFT JOIN setores s ON c.setor_id = s.id
            WHERE c.id = ?
        `;

        db.query(queryDadosTelegram, [novaOsId], (errTelegram, resultsTelegram) => {
            if (!errTelegram && resultsTelegram.length > 0) {
                const dados = resultsTelegram[0];

                const textoTelegram =
                    `🚨 *NOVA ORDEM DE SERVIÇO* 🚨\n\n` +
                    `🎫 *Número da OS:* #${dados.id}\n` +
                    `📍 *Setor:* ${dados.setor_nome || 'Não Informado'}\n` +
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

app.put('/api/chamados/:id/atualizar', (req, res) => {
    const { id } = req.params;
    const { status, tipo_atendimento, descricao_solucao, fornecedor_id, nf_referencia, custo_servico } = req.body;
    const tecnico_nome = req.body.tecnico_responsavel || "Técnico do Sistema";

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        const queryUpdate = `
            UPDATE chamados
            SET status = ?,
                tipo_atendimento = ?,
                tecnico_responsavel = ?,
                fornecedor_id = ?,
                nf_referencia = ?,
                custo_servico = ?,
                data_conclusao = IF(? = 'Concluído', NOW(), data_conclusao)
            WHERE id = ?
        `;
        const valuesUpdate = [status, tipo_atendimento, tecnico_nome, fornecedor_id || null, nf_referencia || null, custo_servico || 0, status, id];

        db.query(queryUpdate, valuesUpdate, (err) => {
            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

            if (descricao_solucao && descricao_solucao.trim() !== "") {
                const queryHist = `
                    INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro)
                    VALUES (?, ?, ?, ?, NOW())
                `;
                db.query(queryHist, [id, tecnico_nome, descricao_solucao, status], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                        res.json({ message: "Chamado e cronologia atualizados com sucesso!" });
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                    res.json({ message: "Chamado updated!" });
                });
            }
        });
    });
});

app.post('/api/chamados/:id/itens', (req, res) => {
    const { id } = req.params;
    const { item_id, quantidade = 0 } = req.body;

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("SELECT nome, quantidade, valor_unitario FROM itens_estoque WHERE id = ?", [item_id], (err, results) => {
            if (err || results.length === 0) return db.rollback(() => res.status(400).json({ error: "Item não localizado." }));

            const item = results[0];
            if (item.quantidade < quantidade) {
                return db.rollback(() => res.status(400).json({ error: "Estoque insuficiente!" }));
            }

            const queryIns = "INSERT INTO chamados_itens (chamado_id, item_id, quantidade, valor_unitario_na_epoca) VALUES (?, ?, ?, ?)";
            db.query(queryIns, [id, item_id, quantidade, item.valor_unitario], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                db.query("UPDATE itens_estoque SET quantidade = quantity = quantidade - ? WHERE id = ?", [quantidade, item_id], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                    const msgEstoque = `Peça utilizada: ${quantidade}x ${item.nome}`;
                    const queryHist = "INSERT INTO chamados_historico (chamado_id, tecnico_nome, texto_historico, status_momento, data_registro) VALUES (?, 'Sistema', ?, 'Em Atendimento', NOW())";

                    db.query(queryHist, [id, msgEstoque], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                        db.commit((err) => {
                            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                            res.json({ message: "Estoque deduzido e associado à OS!" });
                        });
                    });
                });
            });
        });
    });
});

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
    const niveisPermitidos = ['admin', 'coordenador', 'Coordenador', 'Admin'];
    if (!niveisPermitidos.includes(usuario_nivel)) {
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

app.patch('/api/chamados/:id/assinar', (req, res) => {
    const { id } = req.params;
    const { tipo, assinaturaBase64 } = req.body;

    const campo = tipo === 'tecnico' ? 'assinatura_tecnico' : 'assinatura_setor';
    const query = `UPDATE chamados SET ${campo} = ? WHERE id = ?`;

    db.query(query, [assinaturaBase64, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        return res.status(200).json({ message: "Assinatura arquivada com sucesso!" });
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
        const senhaCorreta = await bcrypt.compare(senha, user.senha);

        if (senhaCorreta) {
            res.json({ id: user.id, nome: user.nome, nivel: user.nivel });
        } else {
            res.status(401).json({ error: "Senha incorreta" });
        }
    });
});

app.patch('/api/usuarios/alterar-senha', async (req, res) => {
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

// ROTA: Relatório Avançado de Inventário Geral com Filtro de Período e Centro de Custo
app.get('/api/relatorios/inventario-geral', (req, res) => {
    const { data_inicio, data_fim, setor_id } = req.query;

    // Definição de escopo padrão (Últimos 30 dias se nenhuma data for enviada)
    const inicio = data_inicio ? data_inicio + ' 00:00:00' : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
    const fim = data_fim ? data_fim + ' 23:59:59' : new Date().toISOString().split('T')[0] + ' 23:59:59';

    let queryParams = [inicio, fim, inicio, fim];
    let filtroSetor = '';

    // Filtro condicional por setor de localização do ativo
    if (setor_id && setor_id !== 'todos') {
        filtroSetor = 'WHERE e.setor_id = ?';
        queryParams.push(setor_id);
    }

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
                /* 1. Mão de obra do equipamento filtrada por data */
                SELECT IFNULL(SUM(c.custo_servico), 0) 
                FROM chamados c 
                WHERE c.equipamento_id = e.id AND c.data_abertura BETWEEN ? AND ?
            ) +
            (
                /* 2. Insumos/Peças do equipamento filtrados por data */
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
        res.json(results);
    });
});

// -------------------------------------------------------------------------
// AUXILIARES & CADASTROS ADICIONAIS
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

app.get('/api/types_equipamentos', (req, res) => {
    db.query(`SELECT * FROM tipos_equipamentos ORDER BY nome ASC`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// ROTA: Relatório de Custos Operacionais e Chamados por Setor com filtro de período
app.get('/api/relatorios/custos-setor', (req, res) => {
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
            console.error("Erro ao gerar relatório por setor:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});


// ALTERAÇÃO CIRÚRGICA: Adicionado 'valor_unitario' no SELECT para passar os valores ao React populate o select
app.get('/api/estoque', (req, res) => {
    db.query("SELECT id, nome, descricao, quantidade, valor_unitario FROM itens_estoque WHERE quantidade > 0 ORDER BY nome ASC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});
// ADICIONADO AQUI: Rota para receber o cadastro do formulário do React
app.post('/api/estoque', (req, res) => {
    const { nome, descricao, quantidade, valor_unitario, num_nota } = req.body;
    const qtd = Number(quantity = quantidade) || 0;
    const valor = Number(valor_unitario) || 0.00;

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Insere ou atualiza o item na tabela principal de saldo
        const queryItem = `
            INSERT INTO itens_estoque (nome, descricao, quantidade, valor_unitario, data_cadastro, data_atualizacao) 
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        
        db.query(queryItem, [nome, descricao || null, qtd, valor], (errItem, resultItem) => {
            if (errItem) return db.rollback(() => res.status(500).json({ error: errItem.message }));

            const novoItemId = resultItem.insertId;

            // 2. Grava o histórico de entrada com o número da nota fiscal
            const queryHistorico = `
                INSERT INTO itens_estoque_entradas (item_id, quantity, valor_unitario, num_nota, data_entrada)
                VALUES (?, ?, ?, ?, NOW())
            `;

            db.query(queryHistorico, [novoItemId, qtd, valor, num_nota || null], (errHist) => {
                if (errHist) return db.rollback(() => res.status(500).json({ error: errHist.message }));

                db.commit((errCommit) => {
                    if (errCommit) return db.rollback(() => res.status(500).json({ error: errCommit.message }));
                    res.status(201).json({ message: "Item e nota fiscal registrados com sucesso!", id: novoItemId });
                });
            });
        });
    });
});

app.get('/api/fornecedores', (req, res) => {
    db.query("SELECT id, nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status FROM fornecedores ORDER BY nome_fantasia ASC", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.post('/api/fornecedores', (req, res) => {
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade } = req.body;
    const query = "INSERT INTO fornecedores (nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativo')";
    const values = [nome_fantasia, razao_social || null, cnpj || null, contato || null, telefone || null, email || null, especialidade || null];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor cadastrado com sucesso!", id: result.insertId });
    });
});

app.put('/api/fornecedores/:id', (req, res) => {
    const { id } = req.params;
    const { nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status } = req.body;
    const query = "UPDATE fornecedores SET nome_fantasia=?, razao_social=?, cnpj=?, contato=?, telefone=?, email=?, especialidade=?, status=? WHERE id=?";
    const values = [nome_fantasia, razao_social, cnpj, contato, telefone, email, especialidade, status, id];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor updated!" });
    });
});

app.delete('/api/fornecedores/:id', (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM fornecedores WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fornecedor removido com sucesso!" });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 SEC-H rodando na porta ${PORT}`));