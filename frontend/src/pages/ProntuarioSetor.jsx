import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const ProntuarioSetor = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [setor, setSetor] = useState(null);
    const [chamados, setChamados] = useState([]);
    const [equipamentosSetor, setEquipamentosSetor] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erroAutenticacao, setErroAutenticacao] = useState(false);

    const API_URL = 'http://192.168.5.101:3000/api';

    const obterUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    };

    const carregarDadosSetor = useCallback(async () => {
        setLoading(true);
        const user = obterUsuario();
        const nivel = user ? user.nivel : '';

        try {
            // 1. Busca a lista de setores para encontrar os dados do setor atual
            const resSetores = await fetch(`${API_URL}/setores`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            if (resSetores.status === 401 || resSetores.status === 403) {
                setErroAutenticacao(true);
                return;
            }
            const listaSetores = await resSetores.json();
            const setorAtual = listaSetores.find(s => String(s.id) === String(id));
            setSetor(setorAtual || { id, nome: `Setor #${id}` });

            // 2. Busca todos os chamados atrelados a este setor específico
            const resChamados = await fetch(`${API_URL}/chamados`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            if (resChamados.ok) {
                const todosChamados = await resChamados.json();
                const chamadosDoSetor = todosChamados.filter(c => String(c.setor_id) === String(id));
                setChamados(chamadosDoSetor || []);
            }

            // 3. Busca equipamentos instalados neste setor
            const resEquip = await fetch(`${API_URL}/equipamentos`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            if (resEquip.ok) {
                const todosEquip = await resEquip.json();
                const equipDoSetor = todosEquip.filter(e => String(e.setor_id) === String(id));
                setEquipamentosSetor(equipDoSetor || []);
            }

        } catch (err) {
            console.error("Erro ao carregar prontuário do setor:", err);
        } finally {
            setLoading(false);
        }
    }, [id, API_URL]);

    useEffect(() => {
        carregarDadosSetor();
    }, [carregarDadosSetor]);

    // Redireciona para abertura de OS já pré-selecionando o setor
    const handleCriarChamadoSetor = () => {
        navigate('/chamados', {
            state: {
                setor_id: Number(id),
                pre_configurado: true
            }
        });
    };

    const handleImprimir = () => {
        setTimeout(() => window.print(), 150);
    };

    const formatarDataHora = (dataStr) => {
        if (!dataStr) return '---';
        const [dataPart, horaPart] = dataStr.replace('T', ' ').split(' ');
        const partesData = dataPart.split('-');
        if (partesData.length < 3) return dataStr;
        const [ano, mes, dia] = partesData;
        const dataBR = `${dia}/${mes}/${ano}`;
        if (horaPart) {
            const horaLimpa = horaPart.substring(0, 5);
            return `${dataBR} às ${horaLimpa}`;
        }
        return dataBR;
    };

    // Cálculo do Custo Acumulado Total em Chamados do Setor
    const calcularCustoTotalSetor = () => {
        return chamados.reduce((acc, c) => acc + (Number(c.custo_servico) || 0), 0);
    };

    if (erroAutenticacao) {
        return (
            <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
                Acesso Negado: Seu perfil não possui privilégios para visualizar o prontuário do setor.
            </div>
        );
    }

    if (loading) {
        return <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Carregando prontuário do setor...</div>;
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">

            {/* REGRAS DE IMPRESSÃO A4 */}
            <style>{`
                @media print {
                    body * { 
                        visibility: hidden !important; 
                        background: white !important; 
                    }
                    .hide-print { 
                        display: none !important; 
                    }
                    .relatorio-container, .relatorio-container * { 
                        visibility: visible !important; 
                    }
                    .relatorio-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .impressao-grid {
                        display: grid !important;
                        grid-template-columns: 4fr 8fr !important;
                        gap: 20px !important;
                    }
                    @page { size: A4; margin: 10mm; }
                }
            `}</style>

            {/* BOTÕES DE CONTROLE SUPERIORES */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hide-print">
                <div className="flex items-center gap-3">
                    <span className="text-2xl bg-blue-100 p-2.5 rounded-xl">🏢</span>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Prontuário e Histórico do Setor</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Rastreabilidade de chamados, custos e ativos do ambiente</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <button 
                        type="button"
                        onClick={handleImprimir}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        🖨️ IMPRIMIR FICHA
                    </button>

                    <button 
                        type="button"
                        onClick={handleCriarChamadoSetor}
                        className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-amber-600 transition-all active:scale-95 shadow-md shadow-amber-100"
                    >
                        + ABRIR OS NO SETOR
                    </button>

                    <Link to="/setores" className="bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase hover:bg-slate-300 transition-all">
                        VOLTAR
                    </Link>
                </div>
            </div>

            {/* CONTAINER ALVO DA IMPRESSÃO */}
            <div className="relatorio-container space-y-6">

                {/* CABEÇALHO DE IMPRESSÃO */}
                <div className="hidden print:block bg-white p-4 border-b border-slate-200 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-black text-slate-800 uppercase">CLÍNICA MATERNO INFANTIL DOMINGOS LOURENÇO</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Prontuário e Histórico de Intervenções por Setor / Área</p>
                        </div>
                        <div className="text-right text-[9px] text-slate-400 font-mono">
                            Emissão: {new Date().toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 impressao-grid">

                    {/* LADO ESQUERDO: FICHA DO SETOR */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border print:border-slate-200">
                            <div className="p-6 text-center">
                                <div className="bg-blue-50 w-full h-32 rounded-2xl mb-4 flex items-center justify-center text-blue-500 border border-blue-100">
                                    <span className="text-6xl">🏢</span>
                                </div>

                                <h2 className="font-black text-slate-800 text-xl uppercase leading-tight">{setor?.nome || 'Setor Unificado'}</h2>
                                <p className="text-slate-400 font-bold text-[11px] mt-1 tracking-widest uppercase">Centro de Custo / Área Predial</p>
                            </div>

                            <div className="border-t border-slate-100 p-5 space-y-3 bg-slate-50/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Total de Chamados:</span>
                                    <span className="font-black text-slate-800 font-mono">{chamados.length} OSs</span>
                                </div>

                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Chamados Abertos:</span>
                                    <span className="font-black text-amber-600 font-mono">
                                        {chamados.filter(c => c.status !== 'Concluído').length} Em Aberto
                                    </span>
                                </div>

                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Ativos Instalados:</span>
                                    <span className="font-black text-blue-600 font-mono">{equipamentosSetor.length} Equipamentos</span>
                                </div>

                                {/* CUSTO TOTAL DE MANUTENÇÃO NO SETOR */}
                                <div className="flex justify-between items-center p-3.5 bg-red-50 rounded-2xl border border-red-100 mt-4 print:bg-none print:border-slate-200">
                                    <div>
                                        <span className="text-red-400 font-black text-[9px] uppercase block tracking-wider print:text-slate-600">Custo Total de Serviços</span>
                                        <span className="text-[9px] text-red-300 font-bold block print:text-slate-400">(Soma dos Serviços na Área)</span>
                                    </div>
                                    <span className="text-red-600 font-black text-lg font-mono print:text-slate-900">
                                        R$ {calcularCustoTotalSetor().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* LISTA RÁPIDA DE EQUIPAMENTOS DO SETOR */}
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 print:border print:border-slate-200">
                            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span>⚙️</span> Equipamentos Alocados ({equipamentosSetor.length})
                            </h3>
                            {equipamentosSetor.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">Nenhum equipamento específico associado a este setor.</p>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {equipamentosSetor.map(eq => (
                                        <Link 
                                            key={eq.id} 
                                            to={`/equipamentos/${eq.id}/prontuario`}
                                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors text-xs border border-slate-100"
                                        >
                                            <span className="font-bold text-slate-700 truncate max-w-[160px]">{eq.nome}</span>
                                            <span className="font-mono text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border">Pat: {eq.patrimonio || 'S/P'}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LADO DIREITO: TIMELINE / HISTÓRICO DE OS DO SETOR */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border print:border-slate-200">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                    <span>🕒</span> Histórico de Ordens de Serviço do Setor
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {chamados.length} Registros Encontrados
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 print:text-slate-700">
                                            <th className="p-3.5">OS / Abertura</th>
                                            <th className="p-3.5">Título / Problema</th>
                                            <th className="p-3.5">Ativo Relacionado</th>
                                            <th className="p-3.5">Status</th>
                                            <th className="p-3.5">Técnico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium text-slate-600 divide-y divide-slate-100 print:divide-slate-200">
                                        {chamados.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-10 text-xs font-bold text-slate-400 italic">
                                                    Nenhum chamado foi registrado para este setor até o momento.
                                                </td>
                                            </tr>
                                        ) : (
                                            chamados.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors print:text-[10px]">
                                                    <td className="p-3.5 whitespace-nowrap font-bold text-slate-500 font-mono text-[11px]">
                                                        <div className="text-blue-600 font-black">#{item.id}</div>
                                                        <div className="text-[10px] text-slate-400">{formatarDataHora(item.data_abertura)}</div>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-bold text-slate-700">{item.titulo}</div>
                                                        <div className="text-[11px] text-slate-400 line-clamp-1">{item.descricao_problema}</div>
                                                    </td>
                                                    <td className="p-3.5 font-bold text-slate-600">
                                                        {item.equip_nome ? (
                                                            <span className="text-slate-800">{item.equip_nome} <span className="text-[10px] text-slate-400 font-mono">(Pat: {item.equip_pat || 'S/P'})</span></span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Estrutura / Predial</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                            item.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'Em Atendimento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 italic text-slate-500 font-bold whitespace-nowrap">
                                                        {item.tecnico_responsavel || 'Não atribuído'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProntuarioSetor;