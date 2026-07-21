import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const Prontuario = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [dados, setDados] = useState(null);
    const [erroAutenticacao, setErroAutenticacao] = useState(false);
    const [imagemModal, setImagemModal] = useState(null); // Modal para zoom em foto
    
    const API_URL = 'http://192.168.5.101:3000/api';
    const BASE_URL = 'http://192.168.5.101:3000'; 

    useEffect(() => {
        const usuarioSalvo = localStorage.getItem('user');
        const nivel = usuarioSalvo ? JSON.parse(usuarioSalvo).nivel : '';

        fetch(`${API_URL}/equipamentos/${id}/prontuario`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-usuario-nivel': nivel
            }
        })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    setErroAutenticacao(true);
                    throw new Error("Não autorizado");
                }
                return res.json();
            })
            .then(data => {
                if (data) setDados(data);
            })
            .catch(err => console.error("Erro ao carregar prontuário:", err));
    }, [id]);

    const handleCriarChamadoContextualizado = () => {
        if (!dados || !dados.dados) return;
        
        navigate('/chamados', {
            state: {
                equipamento_id: dados.dados.id,
                setor_id: dados.dados.setor_id,
                pre_configurado: true
            }
        });
    };

    // 🕒 Formatação resiliente de data e hora (Lida com 'T' ou espaço vindo do MySQL com dateStrings: true)
    const formatarDataHora = (dataStr) => {
        if (!dataStr) return '---';
        
        const [dataPart, horaPart] = dataStr.replace('T', ' ').split(' ');
        const partesData = dataPart.split('-');

        if (partesData.length < 3) return dataStr;

        const [ano, mes, dia] = partesData;
        const dataBR = `${dia}/${mes}/${ano}`;

        if (horaPart) {
            const horaLimpa = horaPart.substring(0, 5); // Pega apenas HH:MM
            return `${dataBR} às ${horaLimpa}`;
        }

        return dataBR;
    };

    // 🖼️ Verifica se o arquivo em anexo é uma imagem
    const isImagem = (url) => {
        if (!url) return false;
        const ext = url.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    };

    if (erroAutenticacao) {
        return (
            <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
                Acesso Negado: Seu perfil não possui privilégios para visualizar o prontuário.
            </div>
        );
    }

    if (!dados || !dados.dados) {
        return <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Carregando prontuário...</div>;
    }

    const equip = dados.dados;

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* GATILHO CSS EXATO DOS RELATÓRIOS QUE EVITA TELA EM BRANCO */}
            <style>{`
                @media print {
                    body * { 
                        visibility: hidden; 
                        background: white !important; 
                    }
                    .relatorio-container, .relatorio-container * { 
                        visibility: visible; 
                    }
                    .relatorio-container { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        padding: 0;
                        margin: 0;
                    }
                    .hide-print { 
                        display: none !important; 
                    }
                    .impressao-grid {
                        display: grid !important;
                        grid-template-columns: 4fr 8fr !important;
                        gap: 20px !important;
                    }
                }
            `}</style>

            {/* BOTÕES DE CONTROLE DA TELA (SOMEM NA IMPRESSÃO) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hide-print">
                <div className="flex items-center gap-3">
                    <span className="text-2xl bg-blue-100 p-2.5 rounded-xl">📋</span>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Prontuário e Histórico do Ativo</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Rastreabilidade técnica e ciclo de vida do equipamento</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <button 
                        type="button"
                        onClick={() => window.print()}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        🖨️ IMPRIMIR FICHA
                    </button>
                    <button 
                        type="button"
                        onClick={handleCriarChamadoContextualizado}
                        className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-amber-600 transition-all active:scale-95 shadow-md shadow-amber-100"
                    >
                        + ABRIR OS
                    </button>
                    <Link to="/equipamentos" className="bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs uppercase hover:bg-slate-300 transition-all">
                        VOLTAR
                    </Link>
                </div>
            </div>

            {/* CONTAINER ALVO DA IMPRESSÃO */}
            <div className="relatorio-container space-y-6">

                {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO */}
                <div className="hidden print:block bg-white p-4 border-b border-slate-200 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-black text-slate-800 uppercase">SEC-H ENGENHARIA CLÍNICA — PRONTUÁRIO TÉCNICO</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Relatório de Rastreabilidade e Manutenções do Ativo</p>
                        </div>
                        <div className="text-right text-[9px] text-slate-400 font-mono">
                            Emissão: {new Date().toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 impressao-grid">
                    
                    {/* LADO ESQUERDO: IDENTIDADE E FICHA TÉCNICA */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border print:border-slate-200">
                            <div className="p-6 text-center">
                                
                                {/* FOTO DO ATIVO */}
                                <div className="bg-slate-50 w-full h-48 rounded-2xl mb-4 flex items-center justify-center text-slate-300 overflow-hidden border border-slate-200">
                                    {equip.foto_equipamento ? (
                                        <img 
                                            src={`${BASE_URL}${equip.foto_equipamento}`} 
                                            alt={equip.nome}
                                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => setImagemModal(`${BASE_URL}${equip.foto_equipamento}`)}
                                        />
                                    ) : (
                                        <span className="text-5xl">📷</span>
                                    )}
                                </div>

                                <h2 className="font-black text-slate-800 text-xl uppercase leading-tight">{equip.nome}</h2>
                                <p className="text-slate-400 font-bold text-[11px] mt-1 tracking-widest uppercase">{equip.modelo || 'Modelo não cadastrado'}</p>
                                
                                {/* STATUS OPERACIONAL */}
                                <div className="mt-3">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        equip.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                                        equip.status === 'Em Manutenção' ? 'bg-red-100 text-red-700' :
                                        equip.status === 'Reserva' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        ● {equip.status || 'Ativo'}
                                    </span>
                                </div>
                            </div>

                            {/* DETALHES TÉCNICOS */}
                            <div className="border-t border-slate-100 p-5 space-y-3 bg-slate-50/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Localização:</span>
                                    <span className="text-blue-600 font-black uppercase">{equip.setor_nome || 'Sem Setor'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Patrimônio:</span>
                                    <span className="font-mono font-bold text-slate-700">{equip.patrimonio || 'S/P'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Nº de Série:</span>
                                    <span className="font-mono font-bold text-slate-700">{equip.num_serie || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Fabricante:</span>
                                    <span className="font-bold text-slate-700">{equip.fabricante || 'Não informado'}</span>
                                </div>

                                {/* CUSTO ACUMULADO */}
                                <div className="flex justify-between items-center p-3.5 bg-red-50 rounded-2xl border border-red-100 mt-4 print:bg-none print:border-slate-200">
                                    <div>
                                        <span className="text-red-400 font-black text-[9px] uppercase block tracking-wider print:text-slate-600">Custo Total em Manutenção</span>
                                        <span className="text-[9px] text-red-300 font-bold block print:text-slate-400">(Peças + Serviços + Valor Ativo)</span>
                                    </div>
                                    <span className="text-red-600 font-black text-lg font-mono print:text-slate-900">
                                        R$ {Number(dados.custoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LADO DIREITO: CRONOLOGIA DE INTERVENÇÕES */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border print:border-slate-200">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                    <span>🕒</span> Cronologia Completa de Intervenções
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {dados.timeline ? dados.timeline.length : 0} Eventos Registrados
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 print:text-slate-700">
                                            <th className="p-3.5">Data / Hora</th>
                                            <th className="p-3.5">Descrição do Evento / Laudo</th>
                                            <th className="p-3.5">Tipo</th>
                                            <th className="p-3.5">Responsável</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium text-slate-600 divide-y divide-slate-100 print:divide-slate-200">
                                        {dados.timeline && dados.timeline.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/60 transition-colors print:text-[10px]">
                                                
                                                {/* DATA E HORA FORMATADAS */}
                                                <td className="p-3.5 whitespace-nowrap font-bold text-slate-500 font-mono text-[11px]">
                                                    {formatarDataHora(item.data)}
                                                </td>
                                                
                                                {/* EVENTO E PREVIEW DE ANEXOS */}
                                                <td className="p-3.5">
                                                    <div className="font-bold text-slate-700">{item.evento}</div>

                                                    {/* PREVIEW DO ANEXO SE HOUVER */}
                                                    {item.url_anexo && (
                                                        <div className="mt-2">
                                                            {isImagem(item.url_anexo) ? (
                                                                <div className="flex items-center gap-2">
                                                                    <img 
                                                                        src={`${BASE_URL}${item.url_anexo}`} 
                                                                        alt="Anexo do evento" 
                                                                        className="w-12 h-12 object-cover rounded-xl border-2 border-slate-200 cursor-pointer hover:scale-105 transition-transform"
                                                                        onClick={() => setImagemModal(`${BASE_URL}${item.url_anexo}`)}
                                                                    />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setImagemModal(`${BASE_URL}${item.url_anexo}`)}
                                                                        className="text-[10px] font-black text-blue-600 hover:underline uppercase hide-print"
                                                                    >
                                                                        🔍 Expandir Foto
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <a 
                                                                    href={`${BASE_URL}${item.url_anexo}`} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-100 transition-colors border border-blue-100 uppercase"
                                                                >
                                                                    <span>📄</span> Abrir Documento PDF
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* TIPO DE EVENTO */}
                                                <td className="p-3.5 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black text-white uppercase tracking-wider inline-block ${
                                                        item.tipo && item.tipo.includes('Abertura') ? 'bg-amber-500' :
                                                        item.tipo && item.tipo.includes('Preventiva') ? 'bg-emerald-600' :
                                                        item.tipo && item.tipo.includes('Movimentação') ? 'bg-purple-600' : 'bg-blue-600'
                                                    }`}>
                                                        {item.tipo || 'Intervenção'}
                                                    </span>
                                                </td>

                                                {/* RESPONSÁVEL */}
                                                <td className="p-3.5 italic text-slate-500 font-bold whitespace-nowrap">
                                                    {item.responsavel}
                                                </td>
                                            </tr>
                                        ))}

                                        {(!dados.timeline || dados.timeline.length === 0) && (
                                            <tr>
                                                <td colSpan="4" className="p-8 text-center text-slate-400 font-bold italic">
                                                    Nenhum evento registrado no prontuário até o momento.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RODAPÉ EXCLUSIVO DA IMPRESSÃO */}
                <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Ficha Técnica de Equipamento emitida via SEC-H Engenharia Clínica
                </div>

            </div>

            {/* MODAL DE VISUALIZAÇÃO DE IMAGENS EM TAMANHO REAL */}
            {imagemModal && (
                <div 
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150 hide-print"
                    onClick={() => setImagemModal(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] bg-white p-2 rounded-3xl shadow-2xl">
                        <img 
                            src={imagemModal} 
                            alt="Visualização em alta resolução" 
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain" 
                        />
                        <button 
                            type="button" 
                            className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-8 h-8 font-black text-xs shadow-lg"
                            onClick={() => setImagemModal(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Prontuario;