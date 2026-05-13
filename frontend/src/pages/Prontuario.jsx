import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const Prontuario = () => {
    const { id } = useParams();
    const [dados, setDados] = useState(null);
    const API_URL = 'http://192.168.5.101:3000/api';

    useEffect(() => {
        fetch(`${API_URL}/equipamentos/${id}/prontuario`)
            .then(res => res.json())
            .then(setDados);
    }, [id]);

    if (!dados) return <div className="p-10 text-slate-400 font-bold">Carregando prontuário...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header de Ações */}
            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-2xl bg-blue-100 p-2 rounded-xl">📋</span>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Prontuário do Ativo</h1>
                </div>
                <div className="flex gap-2">
                    <button className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs">+ ABRIR CHAMADO</button>
                    <button className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold text-xs">↔ EMPRESTAR</button>
                    <Link to="/equipamentos" className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-xs">VOLTAR</Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Lado Esquerdo: Identidade do Ativo */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="bg-slate-100 w-full h-48 rounded-2xl mb-4 flex items-center justify-center text-slate-300">
                                <span className="text-5xl">📷</span>
                            </div>
                            <h2 className="font-black text-slate-800 text-xl uppercase leading-tight">{dados.dados.nome}</h2>
                            <p className="text-slate-400 font-bold text-[10px] mt-1 tracking-widest">{dados.dados.modelo}</p>
                        </div>
                        <div className="border-t border-slate-50 p-4 space-y-3">
                            <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold">LOCAL:</span><span className="text-blue-600 font-black uppercase">{dados.dados.setor_nome}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold">PATRIMÔNIO:</span><span className="font-mono font-bold">{dados.dados.patrimonio}</span></div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl mt-4">
                                <span className="text-red-400 font-black text-[10px]">CUSTO ACUMULADO</span>
                                <span className="text-red-600 font-black text-lg">R$ {dados.custoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Cronologia */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">🕒 Cronologia de Intervenções</h3>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                                    <tr>
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Evento</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Responsável</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-medium text-slate-600">
                                    {dados.timeline.map((item, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 whitespace-nowrap font-bold text-slate-400">{new Date(item.data).toLocaleDateString()}</td>
                                            <td className="p-4">{item.evento}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black text-white uppercase ${item.tipo.includes('Abertura') ? 'bg-amber-400' : 'bg-blue-500'}`}>
                                                    {item.tipo}
                                                </span>
                                            </td>
                                            <td className="p-4 italic">{item.responsavel}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Prontuario;
