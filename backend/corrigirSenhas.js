require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function corrigir() {
    console.log("🔄 Gerando hash nativo para a senha padrão...");
    
    // O Node gera o hash oficial exato reconhecido pelo seu validador
    const hashOficial = await bcrypt.hash("hmdl@123", 10);
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'sech'
    });

    try {
        // Atualiza a senha de todos os usuários criados em lote de uma vez só
        const [result] = await connection.query(
            "UPDATE usuarios SET senha = ? WHERE id >= 36", 
            [hashOficial]
        );
        console.log(`✅ Sucesso! ${result.affectedRows} senhas foram calibradas com o hash oficial.`);
    } catch (err) {
        console.error("❌ Erro ao atualizar banco de dados:", err.message);
    } finally {
        await connection.end();
        process.exit(0);
    }
}

corrigir();