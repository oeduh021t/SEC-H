import { useEffect, useState, useRef } from 'react';

const PainelChamados = () => {
  const [chamados, setChamados] = useState([]);
  const [agora, setAgora] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioHabilitado, setAudioHabilitado] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // 🌙 MODO PLANTÃO / FIM DE SEMANA
  const [modoPlantao, setModoPlantao] = useState(() => {
    return localStorage.getItem('painel_modo_plantao') === 'true';
  });
  
  const [dataInicioPlantao, setDataInicioPlantao] = useState(() => {
    return localStorage.getItem('painel_data_inicio_plantao') || null;
  });

  const ultimosIdsRef = useRef(new Set());
  const primeiraCargaRef = useRef(true);
  const scrollContainerAbertosRef = useRef(null);
  const scrollContainerAndamentoRef = useRef(null);

  const API_URL = 'http://192.168.5.101:3000/api';

  // 🗣️ SÍNTESE DE VOZ
  const falarTexto = (texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const vozes = window.speechSynthesis.getVoices();
    const vozPt = vozes.find(v => v.lang === 'pt-BR' || v.lang.includes('pt'));
    if (vozPt) utterance.voice = vozPt;

    window.speechSynthesis.speak(utterance);
  };

  // 🔊 ALARME SONORO + VOZ
  const emitirAlertaCompleto = (novosChamados = []) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const tocarBeep = (freq, start, dur) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + dur);
      };

      tocarBeep(880, 0, 0.25);
      tocarBeep(1174.66, 0.3, 0.45);

      if (novosChamados.length > 0) {
        setTimeout(() => {
          novosChamados.forEach((c) => {
            const setor = c.setor_nome || 'Setor não informado';
            const assunto = c.titulo || 'Sem assunto';
            const mensagem = `Atenção: Novo chamado no setor ${setor}. Assunto: ${assunto}.`;
            falarTexto(mensagem);
          });
        }, 700);
      }
    } catch (e) {
      console.warn("Áudio não pôde ser reproduzido:", e);
    }
  };

  const alternarModoPlantao = () => {
    const novoStatus = !modoPlantao;
    setModoPlantao(novoStatus);
    localStorage.setItem('painel_modo_plantao', String(novoStatus));

    if (novoStatus) {
      const agoraIso = new Date().toISOString();
      setDataInicioPlantao(agoraIso);
      localStorage.setItem('painel_data_inicio_plantao', agoraIso);
    } else {
      setDataInicioPlantao(null);
      localStorage.removeItem('painel_data_inicio_plantao');
    }
  };

  const buscarChamados = async () => {
    try {
      const res = await fetch(`${API_URL}/chamados`, {
        headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': 'admin' }
      });
      const data = await res.json();
      
      const pendentes = (Array.isArray(data) ? data : []).filter(c => c.status !== 'Concluído');

      if (!primeiraCargaRef.current && audioHabilitado) {
        const novos = pendentes.filter(c => !ultimosIdsRef.current.has(c.id) && c.status === 'Aberto');
        if (novos.length > 0) {
          emitirAlertaCompleto(novos);
        }
      }

      ultimosIdsRef.current = new Set(pendentes.map(c => c.id));
      primeiraCargaRef.current = false;
      setChamados(pendentes);
    } catch (err) {
      console.error("Erro ao sincronizar painel:", err);
    }
  };

  useEffect(() => {
    buscarChamados();
    const intervalBusca = setInterval(buscarChamados, 10000);
    const intervalRelogio = setInterval(() => setAgora(new Date()), 1000);

    return () => {
      clearInterval(intervalBusca);
      clearInterval(intervalRelogio);
    };
  }, [audioHabilitado]);

  // 🔄 AUTO-SCROLL SUAVE CONTÍNUO PARA MODO TV
  useEffect(() => {
    if (!autoScroll) return;

    const scrollInterval = setInterval(() => {
      [scrollContainerAbertosRef.current, scrollContainerAndamentoRef.current].forEach(container => {
        if (!container) return;
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          container.scrollBy({ top: 1, behavior: 'auto' });
        }
      });
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [autoScroll]);

  const alternarFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(console.error);
    }
  };

  // ⏱️ CÁLCULO DE TEMPO DECORRIDO
  const calcularTempoDecorrido = (dataInicioStr, prioridade = 'Média') => {
    if (!dataInicioStr) return { texto: '---', atrasado: false };
    const metasHoras = { Urgente: 2, Alta: 6, 'Média': 24, Baixa: 48 };
    const metaHoras = metasHoras[prioridade] || 24;

    const inicio = new Date(dataInicioStr);
    const diffMs = agora - inicio;
    const minutosTotais = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const horasDecorridas = minutosTotais / 60;
    const dias = Math.floor(minutosTotais / 1440);
    const horas = Math.floor((minutosTotais % 1440) / 60);
    const minutos = minutosTotais % 60;

    let texto = '';
    if (dias > 0) texto = `${dias}d ${horas}h ${minutos}m`;
    else if (horas > 0) texto = `${horas}h ${minutos}m`;
    else texto = `${minutos}m`;

    return { texto, atrasado: horasDecorridas > metaHoras };
  };

  // Filtragem
  const chamadosFiltrados = chamados.filter(c => {
    if (!modoPlantao) return true;
    if (!dataInicioPlantao || !c.data_abertura) return true;
    return new Date(c.data_abertura) >= new Date(dataInicioPlantao);
  });

  const totalOcultados = chamados.length - chamadosFiltrados.length;
  const abertos = chamadosFiltrados.filter(c => c.status === 'Aberto');
  const emAtendimento = chamadosFiltrados.filter(c => c.status === 'Em Atendimento');
  const totalUrgentes = chamadosFiltrados.filter(c => c.prioridade === 'Urgente' || c.prioridade === 'Alta').length;

  const formatarDiaSemana = (dataStr) => {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `${dias[d.getDay()]} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const obterSolicitante = (c) => {
    return c.solicitante_nome || c.usuario_nome || c.usuario_abertura_nome || c.criado_por || 'Solicitante não informado';
  };

  return (
    <div className="min-h-screen p-5 flex flex-col justify-between font-sans select-none bg-slate-950 text-white">
      
      {/* HEADER PRINCIPAL */}
      <div>
        {/* AVISO DE MODO PLANTÃO */}
        {modoPlantao && (
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white px-6 py-2 rounded-2xl mb-4 font-black flex flex-wrap items-center justify-between shadow-lg text-xs md:text-sm animate-pulse">
            <div className="flex items-center gap-2">
              <span>🚨</span>
              <span>MODO PLANTÃO ATIVO — Monitorando ocorrências abertas desde: {dataInicioPlantao ? new Date(dataInicioPlantao).toLocaleString('pt-BR') : '---'}</span>
            </div>
            <div className="bg-black/30 px-3 py-0.5 rounded-xl text-xs font-mono">
              📦 {totalOcultados} chamado(s) anteriores ocultados
            </div>
          </div>
        )}

        <header className="flex flex-wrap justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-3xl mb-5 shadow-2xl gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 text-slate-950 font-black px-3.5 py-2 rounded-2xl text-xl tracking-wider shadow-md shadow-amber-500/20">
              SEC-H
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
                PAINEL DE OPERAÇÕES • MANUTENÇÃO
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Hospital Domingos Lourenço • Transmissão em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* BOTÃO AUTO-SCROLL */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                autoScroll ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Rolar lista automaticamente em telas de TV"
            >
              <span>{autoScroll ? '📜' : '⏸️'}</span>
              <span>{autoScroll ? 'AUTO-SCROLL' : 'PAUSADO'}</span>
            </button>

            {/* BOTÃO MODO PLANTÃO */}
            <button
              onClick={alternarModoPlantao}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md ${
                modoPlantao 
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-300' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Alternar foco apenas para o plantão"
            >
              <span>{modoPlantao ? '☀️' : '🌙'}</span>
              <span>{modoPlantao ? 'DESATIVAR PLANTÃO' : 'MODO FIM DE SEMANA'}</span>
            </button>

            {/* BOTÃO DE VOZ */}
            <button 
              onClick={() => { 
                const novoStatus = !audioHabilitado;
                setAudioHabilitado(novoStatus); 
                if (novoStatus) {
                  emitirAlertaCompleto();
                  falarTexto("Sistema de áudio e avisos por voz ativado.");
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                audioHabilitado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
              }`}
            >
              {audioHabilitado ? '🔊 VOZ ATIVA' : '🔇 ATIVAR VOZ'}
            </button>

            {/* RELÓGIO */}
            <div className="bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-xl text-xl font-black text-amber-400 font-mono tracking-wider">
              {agora.toLocaleTimeString('pt-BR')}
            </div>

            {/* FULLSCREEN */}
            <button 
              onClick={alternarFullScreen}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-black border border-slate-700 transition-all"
            >
              {isFullScreen ? '↙ SAIR' : '⛶ FULLSCREEN'}
            </button>
          </div>
        </header>

        {/* GRID DE COLUNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUNA: AGUARDANDO ATENDIMENTO (ABERTOS) */}
          <section className="bg-slate-900/60 border border-red-900/40 rounded-3xl p-5 flex flex-col h-[70vh]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-red-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block"></span>
                Aguardando Atendimento
              </h2>
              <span className="bg-red-500 text-white font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-red-500/30">
                {abertos.length}
              </span>
            </div>

            <div ref={scrollContainerAbertosRef} className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {abertos.map(c => {
                const tempo = calcularTempoDecorrido(c.data_abertura, c.prioridade);

                return (
                  <div 
                    key={c.id} 
                    className="bg-slate-900 border-l-[10px] border-red-500 border-y border-r border-slate-800 p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-amber-400 font-black text-xs uppercase bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                        📍 {c.setor_nome || 'Setor Geral'}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* CRONÔMETRO DECORRIDO */}
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono border ${
                          tempo.atrasado ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}>
                          ⏱️ {tempo.texto}
                        </span>
                        <span className="text-slate-500 font-mono text-xs font-bold">#{c.id}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-white leading-tight mb-2 uppercase">{c.titulo}</h3>
                    <p className="text-slate-300 text-xs font-medium line-clamp-2 mb-3 leading-relaxed">{c.descricao_problema}</p>

                    {c.equip_nome && (
                      <div className="bg-slate-950 p-2 rounded-xl text-xs text-blue-400 font-bold border border-slate-800 mb-3 flex items-center gap-2">
                        <span>⚙️</span>
                        <span>[{c.equip_pat || 'S/P'}] {c.equip_nome}</span>
                      </div>
                    )}

                    {/* SOLICITANTE */}
                    <div className="bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 font-bold truncate">
                        <span className="text-slate-500 text-[10px] uppercase">Solicitante:</span>
                        <span className="text-amber-300 font-black uppercase truncate">{obterSolicitante(c)}</span>
                      </div>
                      {c.categoria && (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase">
                          {c.categoria}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-2 border-t border-slate-800">
                      <span>Prioridade: <strong className={c.prioridade === 'Urgente' ? 'text-red-400 font-black' : 'text-slate-300'}>{c.prioridade || 'Média'}</strong></span>
                      <span className="text-amber-300 font-mono">📅 Aberto: {formatarDiaSemana(c.data_abertura)}</span>
                    </div>
                  </div>
                );
              })}

              {abertos.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 font-bold italic py-20 gap-2">
                  <span className="text-4xl">✨</span>
                  <span>Nenhum chamado pendente no momento.</span>
                </div>
              )}
            </div>
          </section>

          {/* COLUNA: EM ANDAMENTO */}
          <section className="bg-slate-900/60 border border-amber-900/40 rounded-3xl p-5 flex flex-col h-[70vh]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                Em Andamento / Atendimento
              </h2>
              <span className="bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-amber-500/30">
                {emAtendimento.length}
              </span>
            </div>

            <div ref={scrollContainerAndamentoRef} className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {emAtendimento.map(c => {
                const tempo = calcularTempoDecorrido(c.data_abertura, c.prioridade);

                return (
                  <div key={c.id} className="bg-slate-900 border-l-[10px] border-amber-400 border-y border-r border-slate-800 p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-amber-300 font-black text-xs uppercase bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                        📍 {c.setor_nome || 'Setor Geral'}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono bg-slate-950 text-slate-300 border border-slate-800">
                          ⏱️ {tempo.texto}
                        </span>
                        <span className="text-slate-500 font-mono text-xs font-bold">#{c.id}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-slate-100 leading-tight mb-2 uppercase">{c.titulo}</h3>
                    
                    {c.equip_nome && (
                      <div className="bg-slate-950 p-2 rounded-xl text-xs text-blue-400 font-bold border border-slate-800 mb-3 flex items-center gap-2">
                        <span>⚙️</span>
                        <span>[{c.equip_pat || 'S/P'}] {c.equip_nome}</span>
                      </div>
                    )}

                    {/* SOLICITANTE & TÉCNICO RESPONSÁVEL */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 mb-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-bold truncate">
                        <span>👤 <span className="text-slate-500 text-[10px] uppercase">Solicitante:</span> <strong className="text-slate-200 uppercase">{obterSolicitante(c)}</strong></span>
                      </div>
                      <div className="flex items-center justify-between text-blue-400 font-bold pt-1 border-t border-slate-800/80">
                        <span>👨‍🔧 <span className="text-slate-500 text-[10px] uppercase">Técnico:</span> <strong className="text-blue-300 uppercase">{c.tecnico_responsavel || c.nome_tecnico || 'Atribuído'}</strong></span>
                        <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Em Execução</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-2 border-t border-slate-800">
                      <span>Prioridade: <strong className="text-slate-300">{c.prioridade || 'Média'}</strong></span>
                      <span className="text-amber-300 font-mono">📅 Aberto: {formatarDiaSemana(c.data_abertura)}</span>
                    </div>
                  </div>
                );
              })}

              {emAtendimento.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 font-bold italic py-20 gap-2">
                  <span className="text-4xl">🛠️</span>
                  <span>Nenhum atendimento em curso no momento.</span>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* RODAPÉ INFORMATIVO DA TV */}
      <footer className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap justify-between items-center text-xs text-slate-400 font-bold">
        <div className="flex items-center gap-4">
          <span>Total em Aberto: <strong className="text-white">{chamadosFiltrados.length}</strong></span>
          <span>•</span>
          <span>Urgentes/Altas: <strong className="text-red-400">{totalUrgentes}</strong></span>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
          SEC-H • Engenharia Clínica Hospital Domingos Lourenço
        </div>
      </footer>

    </div>
  );
};

export default PainelChamados;