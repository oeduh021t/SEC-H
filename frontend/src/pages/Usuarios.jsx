import { useEffect, useState } from 'react';

const Usuarios = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [modal, setModal] = useState({ aberto: false, modo: 'novo', dados: {} });
    const API_URL = 'http://192.168.5.101:3000/api';

    // 🔑 AUXILIAR: Captura dinamicamente o privilégio operacional do administrador logado
    const obterNivelUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser).nivel : '';
    };

    const carregar = () => {
        fetch(`${API_URL}/usuarios`, {
            headers: { "x-usuario-nivel": obterNivelUsuario() } // 🔑 Header de segurança injetado
        })
        .then(res => res.json())
        .then(setUsuarios)
        .catch(err => console.error("Erro ao carregar lista de usuários:", err));
    };

    useEffect(() => { carregar(); }, []);

    const salvar = (e) => {
        e.preventDefault();
        const metodo = modal.modo === 'novo' ? 'POST' : 'PUT';
        const url = modal.modo === 'novo' ? `${API_URL}/usuarios` : `${API_URL}/usuarios/${modal.dados.id}`;

        fetch(url, {
            method: metodo,
            headers: { 
                'Content-Type': 'application/json',
                'x-usuario-nivel': obterNivelUsuario() // 🔑 Header de segurança injetado
            },
            body: JSON.stringify(modal.dados)
        }).then((res) => {
            if (res.ok) {
                setModal({ aberto: false, modo: 'novo', dados: {} });
                carregar();
            } else {
                alert("Erro ao salvar o usuário. Verifique se possui permissões de Administrador.");
            }
        }).catch(err => console.error("Erro na requisição:", err));
    };

    const excluir = (id) => {
        if (window.confirm("Deseja excluir este acesso?")) {
            fetch(`${API_URL}/usuarios/${id}`, { 
                method: 'DELETE',
                headers: { "x-usuario-nivel": obterNivelUsuario() } // 🔑 Header de segurança injetado
            }).then((res) => {
                if (res.ok) {
                    carregar();
                } else {
                    alert("Erro ao remover usuário. Certifique-se de que não está tentando excluir o Administrador Mestre.");
                }
            }).catch(err => console.error("Erro na remoção:", err));
        }
    };

    const getBadge = (nivel) => {
        const styles = {
            admin: 'bg-slate-900 text-white',
            coordenador: 'bg-blue-600 text-white',
            tecnico: 'bg-green-600 text-white',
            usuario: 'bg-slate-200 text-slate-700'
        };
        return styles[nivel] || styles.usuario;
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">GESTÃO DE ACESSOS</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Usuários e Permissões do Sistema</p>
                </div>
                <button 
                    onClick={() => setModal({ aberto: true, modo: 'novo', dados: { nivel: 'usuario' } })}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                    Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-dark">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="p-5">Nome Completo</th>
                            <th className="p-5">Login</th>
                            <th className="p-5">Nível</th>
                            <th className="p-5 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5 font-bold text-slate-700">{u.nome}</td>
                                <td className="p-5 font-mono text-xs text-blue-500 font-bold">{u.login}</td>
                                <td className="p-5">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getBadge(u.nivel)}`}>
                                        {u.nivel}
                                    </span>
                                </td>
                                <td className="p-5 text-right space-x-2">
                                    <button 
                                        onClick={() => setModal({ aberto: true, modo: 'editar', dados: u })}
                                        className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        onClick={() => excluir(u.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL INTEGRADO */}
            {modal.aberto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={salvar} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-dark">
                        <div className={`p-6 text-white font-black uppercase text-xs tracking-widest ${modal.modo === 'novo' ? 'bg-blue-600' : 'bg-slate-800'}`}>
                            {modal.modo === 'novo' ? 'Cadastrar Usuário' : 'Editar Usuário'}
                        </div>
                        <div className="p-8 space-y-4">
                            <input 
                                type="text" placeholder="Nome Completo" required
                                className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-400 font-bold text-black bg-white"
                                value={modal.dados.nome || ''} 
                                onChange={e => setModal({...modal, dados: {...modal.dados, nome: e.target.value}})}
                            />
                            <input 
                                type="text" placeholder="Login de Acesso" required
                                className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-400 font-bold text-black bg-white"
                                value={modal.dados.login || ''} 
                                onChange={e => setModal({...modal, dados: {...modal.dados, login: e.target.value}})}
                            />
                            <input 
                                type="password" 
                                placeholder={modal.modo === 'novo' ? 'Senha' : 'Nova Senha (Opcional)'}
                                required={modal.modo === 'novo'}
                                className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-400 font-bold text-black bg-white"
                                onChange={e => setModal({...modal, dados: {...modal.dados, [modal.modo === 'novo' ? 'senha' : 'senha_nova']: e.target.value}})}
                            />
                            <select 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-700 bg-white"
                                value={modal.dados.nivel || 'usuario'}
                                onChange={e => setModal({...modal, dados: {...modal.dados, nivel: e.target.value}})}
                            >
                                <option value="usuario">Solicitante</option>
                                <option value="tecnico">Técnico</option>
                                <option value="coordenador">Coordenador</option>
                                <option value="admin">Administrador</option>
                            </select>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setModal({ aberto: false, modo: 'novo', dados: {} })} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Salvar Alterações</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Usuarios;