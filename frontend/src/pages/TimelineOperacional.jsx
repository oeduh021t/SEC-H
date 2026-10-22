import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiClock, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiTool, 
  FiTruck, 
  FiUser, 
  FiCalendar, 
  FiPrinter, 
  FiSearch,
  FiRefreshCw,
  FiExternalLink
} from 'react-icons/fi';

export default function TimelineOperacional() {
  const hoje = new Date().toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [buscaTexto, setBuscaTexto] = useState('');

  const [dados, setDados] = useState({
    resumo: {
      abertos_no_periodo: 0,
      em_atendimento_atual: 0,
      concluidos_no_periodo: 0,
      em_custodia_externa: 0
    },
    timeline: []
  });

  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Carrega lista de técnicos
  useEffect(() => {
    fetch('/api/tecnicos')
      .then(res => res.json())
      .then(data => setTecnicos(Array.isArray(data) ? data : []))
      .catch(err => console.error("Erro ao carregar técnicos:", err));
  }, []);

  // 2. Busca dados da timeline
  const buscarTimeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        tecnico: filtroTecnico,
        status: filtroStatus
      });

      const res = await fetch(`/api/timeline-operacional?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDados(data);
      } else {
        console.error("Falha na resposta da timeline:", res.status);
      }
    } catch (err) {
      console.error("Erro ao buscar timeline operacional:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarTimeline();
  }, [dataInicio, dataFim, filtroTecnico, filtroStatus]);

  // 3. Atalhos rápidos de data
  const aplicarPeriodo = (tipo) => {
    const d = new Date();
    if (tipo === 'hoje') {
      const dataStr = d.toISOString().split('T')[0];
      setDataInicio(dataStr);
      setDataFim(dataStr);
    } else if (tipo === 'ontem') {
      d.setDate(d.getDate() - 1);
      const dataStr = d.toISOString().split('T')[0];
      setDataInicio(dataStr);
      setDataFim(dataStr);
    } else if (tipo === 'semana') {
      const fimStr = d.toISOString().split('T')[0];
      d.setDate(d.getDate() - 7);
      const iniStr = d.toISOString().split('T')[0];
      setDataInicio(iniStr);
      setDataFim(fimStr);
    }
  };

  // 4. Filtro em tempo real no front
  const timelineFiltrada = useMemo(() => {
    if (!buscaTexto.trim()) return dados.timeline || [];
    const termo = buscaTexto.toLowerCase();
    return (dados.timeline || []).filter(item => 
      (item.chamado_titulo && item.chamado_titulo.toLowerCase().includes(termo)) ||
      (item.descricao && item.descricao.toLowerCase().includes(termo)) ||
      (item.equipamento_nome && item.equipamento_nome.toLowerCase().includes(termo)) ||
      (item.setor_nome && item.setor_nome.toLowerCase().includes(termo)) ||
      String(item.chamado_id).includes(termo)
    );
  }, [dados.timeline, buscaTexto]);

  // 5. Configuração visual dos badges
  const getStatusBadge = (status, tipoEvento) => {
    if (tipoEvento === 'abertura') {
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        icon: FiAlertCircle,
        label: 'Abertura de Chamado'
      };
    }

    switch (status) {
      case 'Concluído':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: FiCheckCircle,
          label: 'Chamado Concluído'
        };
      case 'Aguardando Externa':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
          icon: FiTruck,
          label: 'Manutenção Externa'
        };
      case 'Em Atendimento':
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: FiTool,
          label: 'Ação Técnica / Atualização'
        };
    }
  };

  const formatarDataBR = (dataStr) => {
    if (!dataStr) return "";
    const partes = dataStr.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataStr;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800">
      
      {/* 🖨️ MOTOR DE IMPRESSÃO ISOLADO */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: transparent !important;
          }
          .timeline-print-container, 
          .timeline-print-container * {
            visibility: visible !important;
          }
          .timeline-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-kpis {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 20px !important;
          }
          .print-kpis > div {
            border: 1px solid #cbd5e1 !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            background: #f8fafc !important;
          }
          .timeline-card-print {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1px solid #cbd5e1 !important;
            margin-bottom: 12px !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* CABEÇALHO DE TELA (NO-PRINT) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FiClock className="w-7 h-7 text-blue-600" />
            Diário de Bordo & Linha do Tempo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rastreabilidade minuto a minuto de todas as intervenções e chamados operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => buscarTimeline()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase tracking-wider text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-md cursor-pointer active:scale-95"
          >
            <FiPrinter className="w-4 h-4" />
            Imprimir Turno
          </button>
        </div>
      </div>

      {/* FILTROS E CONTROLES (NO-PRINT) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => aplicarPeriodo('hoje')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${dataInicio === hoje && dataFim === hoje ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Hoje
            </button>
            <button
              onClick={() => aplicarPeriodo('ontem')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Ontem
            </button>
            <button
              onClick={() => aplicarPeriodo('semana')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Últimos 7 dias
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <FiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar por OS, ativo ou setor..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Técnico / Responsável</label>
            <select
              value={filtroTecnico}
              onChange={(e) => setFiltroTecnico(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Responsáveis</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.nome}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Status Resultante</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="Aberto">Aberto</option>
              <option value="Em Atendimento">Em Atendimento</option>
              <option value="Aguardando Externa">Aguardando Externa</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🎯 CONTAINER ISOLADO DE IMPRESSÃO E VISUALIZAÇÃO DE TELA */}
      {/* ========================================================================= */}
      <div className="timeline-print-container space-y-6">
        
        {/* CABEÇALHO HOSPITALAR (FORMATADO PARA PAPEL / IMPRESSÃO) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-b-2 print:border-slate-800 print:rounded-none print:shadow-none print:p-0 print:pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 print:text-lg">
                SEC-H — DIÁRIO DE BORDO & FECHAMENTO DE TURNO
              </h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 print:text-[10px]">
                Hospital Domingos Lourenço • Engenharia Clínica & Manutenção Predial
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="text-xs font-mono font-bold text-blue-600 block print:text-[10px] print:text-slate-800">
                Período: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 block uppercase print:text-[8px]">
                {filtroTecnico ? `Filtro Técnico: ${filtroTecnico}` : 'Escala Geral'} • {timelineFiltrada.length} eventos
              </span>
            </div>
          </div>
        </div>

        {/* CARDS DE RESUMO OPERACIONAL (PRINT-KPIS) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-kpis">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 no-print">
              <FiAlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider print:text-[8px]">Abertos no Turno</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 print:text-sm">{dados.resumo?.abertos_no_periodo || 0}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 no-print">
              <FiTool className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider print:text-[8px]">Em Atendimento</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 print:text-sm">{dados.resumo?.em_atendimento_atual || 0}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 no-print">
              <FiCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider print:text-[8px]">Concluídos</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 print:text-sm">{dados.resumo?.concluidos_no_periodo || 0}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 no-print">
              <FiTruck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider print:text-[8px]">Custódia Externa</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 print:text-sm">{dados.resumo?.em_custodia_externa || 0}</h3>
            </div>
          </div>
        </div>

        {/* FEED DE EVENTOS / DIÁRIO OPERACIONAL */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 print:border-none print:shadow-none print:p-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5 print:pb-2 print:mb-3">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 print:text-[10px]">
              <FiCalendar className="w-4 h-4 text-slate-500 no-print" />
              Eventos Cronológicos do Plantão ({timelineFiltrada.length} apontamentos)
            </h2>
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Ordem Decrescente</span>
          </div>

          {timelineFiltrada.length === 0 ? (
            <div className="text-center py-12">
              <FiClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-medium text-slate-600">Nenhuma movimentação registrada no período.</p>
              <p className="text-xs text-slate-400 mt-1">Ajuste o filtro de datas ou selecione outro colaborador.</p>
            </div>
          ) : (
            <div className="relative pl-6 md:pl-8 space-y-4 before:content-[''] before:absolute before:left-3 md:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 print:before:hidden print:pl-0 print:space-y-3">
              {timelineFiltrada.map((item, index) => {
                const conf = getStatusBadge(item.status_resultante, item.tipo_evento);
                const Icone = conf.icon;
                const dataObj = new Date(item.data_hora);
                const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const diaFormatado = dataObj.toLocaleDateString('pt-BR');

                return (
                  <div key={`${item.tipo_evento}-${item.evento_id}-${index}`} className="relative group timeline-card-print">
                    
                    {/* Marcador na Timeline (Oculto no papel) */}
                    <div className={`absolute -left-[30px] md:-left-[38px] top-1.5 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white ${conf.dot} no-print`}>
                      <Icone className="w-3.5 h-3.5" />
                    </div>

                    <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-2.5 print:bg-white print:p-3 print:rounded-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 print:pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono print:text-[10px] print:border-none print:p-0">
                            {horaFormatada}
                          </span>
                          <span className="text-xs text-slate-400 font-medium print:text-[9px]">({diaFormatado})</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${conf.bg} print:border-none print:p-0 print:text-[9px]`}>
                            {conf.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 print:text-[9px]">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-bold print:border print:border-slate-300">
                            OS #{item.chamado_id}
                          </span>
                          {item.prioridade && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              item.prioridade === 'Urgente' ? 'bg-red-100 text-red-700' :
                              item.prioridade === 'Alta' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-200 text-slate-700'
                            } print:text-[8px]`}>
                              {item.prioridade}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight print:text-[11px]">
                          {item.chamado_titulo}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 print:text-[9px]">
                          <span className="font-bold text-slate-700 uppercase">Setor:</span> {item.setor_nome || 'Geral'} 
                          {item.equipamento_nome && (
                            <> • <span className="font-bold text-slate-700 uppercase">Ativo:</span> {item.equipamento_nome} (Pat: {item.equipamento_patrimonio || 'S/P'})</>
                          )}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans print:p-2 print:text-[10px] print:border-slate-300">
                        {item.descricao || 'Sem descrição registrada.'}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/50 print:text-[9px] print:pt-1">
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <FiUser className="w-3.5 h-3.5 text-slate-400 no-print" />
                          <span>Responsável Técnico: <strong className="text-slate-900 font-bold">{item.tecnico_nome}</strong></span>
                        </div>

                        {item.arquivo_url && (
                          <div className="no-print">
                            <a
                              href={item.arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                            >
                              Ver Anexo / Foto
                              <FiExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RODAPÉ EXCLUSIVO DA IMPRESSÃO */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-center text-[9px] text-slate-500 font-bold uppercase tracking-wider">
          <div className="flex justify-between items-center mb-6 px-8 pt-6">
            <div className="text-center w-64 border-t border-slate-400 pt-1">
              <p className="text-[10px] font-black text-slate-800">TÉCNICO / PLANTONISTA</p>
              <p className="text-[8px] text-slate-400">Assinatura do Responsável</p>
            </div>
            <div className="text-center w-64 border-t border-slate-400 pt-1">
              <p className="text-[10px] font-black text-slate-800">SUPERVISÃO / ENGENHARIA</p>
              <p className="text-[8px] text-slate-400">Ciente da Coordenação</p>
            </div>
          </div>
          Documento gerado pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')} • Página de Registro Operacional
        </div>

      </div>
    </div>
  );
}