import { useEffect, useState } from 'react';

const Preventivas = () => {
    const [dados, setDados] = useState([]);
    const [modalBaixa, setModalBaixa] = useState(false);
    const [selecionado, setSelecionado] = useState(null);
    const [relatorio, setRelatorio] = useState('');
    const API_URL = 'http://192.168.5.101:3000/api';

    const carregar = () => {
        fetch(`${API_URL}/preventivas`).then(res => res.json()).then(setDados);
    };

    useEffect(() => { carregar(); }, []);

    const handleBaixa = (e) => {
        e.preventDefault();
        fetch(`${API_URL}/preventivas/baixa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                equipamento_id: selecionado.id,
                relatorio_tecnico: relatorio,
                tecnico_nome: 'Eduardo Nascimento'
            })
        }).then(() => {
            setModalBaixa(false);
            setRelatorio('');
            carregar();
        });
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="bg-green-100 p-2 rounded-xl text-green-600 text-sm">📅</span>
                GESTÃO DE PREVENTIVAS / PMOC
            </h1>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                        <tr>
                            <th className="p-5">Equipamento</th>
                            <th className="p-5">Localização</th>
                            <th className="p-5">Vencimento</th>
                            <th className="p-5">Situação</th>
                            <th className="p-5 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {dados.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors text-dark">
                                <td className="p-5">
                                    <div className="font-bold text-slate-700">{p.nome}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">PAT: {p.patrimonio}</div>
                                </td>
                                <td className="p-5">
                                    <div className="text-xs font-black text-blue-600 uppercase">{p.setor_nome}</div>
                                </td>
                                <td className="p-5">
                                    <div className="text-xs font-bold text-slate-600">{new Date(p.data_vencimento).toLocaleDateString()}</div>
                                    <div className="text-[10px] text-slate-400">Última: {new Date(p.data_ultima_preventiva).toLocaleDateString()}</div>
                                </td>
                                <td className="p-5">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        p.dias_restantes < 0 ? 'bg-red-500 text-white' : 
                                        p.dias_restantes <= 7 ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'
                                    }`}>
                                        {p.dias_restantes < 0 ? `Atrasada (${Math.abs(p.dias_restantes)}d)` : `Em dia (${p.dias_restantes}d)`}
                                    </span>
                                </td>
                                <td className="p-5 text-center">
                                    <button 
                                        onClick={() => { setSelecionado(p); setModalBaixa(true); }}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-green-100 transition-all"
                                    >
                                        Dar Baixa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE BAIXA TÉCNICA */}
            {modalBaixa && selecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleBaixa} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-dark">
                        <div className="bg-green-600 p-5 text-white font-black uppercase text-xs tracking-widest">
                            Baixa Técnica: {selecionado.nome}
                        </div>
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Relatório de Execução</label>
                                <textarea 
                                    required 
                                    value={relatorio}
                                    onChange={e => setRelatorio(e.target.value)}
                                    className="w-full border-2 border-slate-100 rounded-2xl p-4 h-32 focus:border-green-400 outline-none transition-all resize-none text-sm font-medium" 
                                    placeholder="Descreva o que foi realizado (Limpeza, testes, troca de filtros...)"
                                ></textarea>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-xl flex items-center gap-3">
                                <span className="text-xl">ℹ️</span>
                                <p className="text-[10px] font-bold text-blue-600 leading-tight">A data da última preventiva será atualizada para hoje automaticamente.</p>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setModalBaixa(false)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-100 hover:bg-green-700 transition-all">CONFIRMAR EXECUÇÃO</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Preventivas;
