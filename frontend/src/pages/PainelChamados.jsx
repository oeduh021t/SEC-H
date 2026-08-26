import { useEffect, useState, useRef } from 'react';

const PainelChamados = () => {
  const [chamados, setChamados] = useState([]);
  const [agora, setAgora] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioHabilitado, setAudioHabilitado] = useState(false);

  // 🌙 MODO PLANTÃO / FIM DE SEMANA (Persistido no LocalStorage)
  const [modoPlantao, setModoPlantao] = useState(() => {
    return localStorage.getItem('painel_modo_plantao') === 'true';
  });
  
  // Data/hora de quando o modo plantão foi ligado
  const [dataInicioPlantao, setDataInicioPlantao] = useState(() => {
    return localStorage.getItem('painel_data_inicio_plantao') || null;
  });

  const ultimosIdsRef = useRef(new Set());
  const primeiraCargaRef = useRef(true);

  const API_URL = 'http://192.168.5.101:3000/api';

  // 🗣️ FUNÇÃO DE SÍNTESE DE VOZ (Fala Setor + Assunto)
  const falarTexto = (texto) => {
    if (!('speechSynthesis' in window)) return;

    // Cancela falas anteriores na fila para não acumular
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Velocidade da fala levemente mais dinâmica
    utterance.pitch = 1.0; // Tom de voz padrão

    // Tenta priorizar uma voz brasileira de boa qualidade
    const vozes = window.speechSynthesis.getVoices();
    const vozPt = vozes.find(v => v.lang === 'pt-BR' || v.lang.includes('pt'));
    if (vozPt) utterance.voice = vozPt;

    window.speechSynthesis.speak(utterance);
  };

  // 🔊 Alarme sonoro em dois tons + Anúncio de Voz
  const emitirAlertaCompleto = (novosChamados = []) => {
    try {
      // 1. Toca o Ding-Dong sonoro primeiro
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

      // 2. Se houver chamados novos, anuncia via voz após 0.7 segundos
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
      
      const pendentes = data.filter(c => c.status !== 'Concluído');

      // Se houver novos chamados abertos e o áudio estiver ativo, anuncia por voz
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

  const alternarFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(console.error);
    }
  };

  // 🎯 FILTRAGEM DO MODO PLANTÃO / FINAL DE SEMANA
  const chamadosFiltrados = chamados.filter(c => {
    if (!modoPlantao) return true;
    if (!dataInicioPlantao || !c.data_abertura) return true;

    // Apenas chamados abertos DEPOIS da ativação do modo plantão
    return new Date(c.data_abertura) >= new Date(dataInicioPlantao);
  });

  const totalOcultados = chamados.length - chamadosFiltrados.length;

  // Separação dos chamados
  const abertos = chamadosFiltrados.filter(c => c.status === 'Aberto');
  const emAtendimento = chamadosFiltrados.filter(c => c.status === 'Em Atendimento');

  // Identificador do dia de abertura (Ex: Sábado, Domingo, Sexta)
  const formatarDiaSemana = (dataStr) => {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return `${dias[d.getDay()]} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Helper para obter o nome do solicitante
  const obterSolicitante = (c) => {
    return c.solicitante_nome || c.usuario_nome || c.usuario_abertura_nome || c.criado_por || 'Solicitante não informado';
  };

  return (
    <div className="min-h-screen p-6 flex flex-col font-sans select-none bg-slate-950 text-white transition-colors duration-500">
      
      {/* 🚨 AVISO DE MODO PLANTÃO ATIVO */}
      {modoPlantao && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white px-6 py-2.5 rounded-2xl mb-4 font-black flex flex-wrap items-center justify-between shadow-lg text-xs md:text-sm animate-pulse">
          <div className="flex items-center gap-2">
            <span>🚨</span>
            <span>MODO PLANTÃO ATIVO — Exibindo apenas ocorrências abertas no plantão (Desde: {dataInicioPlantao ? new Date(dataInicioPlantao).toLocaleString('pt-BR') : '---'})</span>
          </div>
          <div className="bg-black/30 px-3 py-1 rounded-xl text-xs">
            📦 {totalOcultados} chamado(s) anteriores ocultados
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="flex flex-wrap justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-6 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xl tracking-wider">
            SEC-H
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2">
              PAINEL DE OPERAÇÕES • MANUTENÇÃO
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Atualização automática em tempo real</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 🌙 BOTÃO ATIVAR/DESATIVAR MODO FIM DE SEMANA / PLANTÃO */}
          <button
            onClick={alternarModoPlantao}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md ${
              modoPlantao 
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-900' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Ative na sexta à tarde para o plantonista focar apenas nos chamados novos do fim de semana"
          >
            <span>{modoPlantao ? '☀️' : '🌙'}</span>
            <span>{modoPlantao ? 'DESATIVAR PLANTÃO' : 'MODO FIM DE SEMANA'}</span>
          </button>

          {/* 🔊 BOTÃO DE ÁUDIO E VOZ */}
          <button 
            onClick={() => { 
              const novoStatus = !audioHabilitado;
              setAudioHabilitado(novoStatus); 
              if (novoStatus) {
                emitirAlertaCompleto();
                falarTexto("Sistema de áudio e avisos por voz ativado.");
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              audioHabilitado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
            }`}
            title="Clique para habilitar/desabilitar alertas sonoros e voz"
          >
            {audioHabilitado ? '🔊 VOZ E SOM ATIVOS' : '🔇 CLIQUE P/ ATIVAR VOZ'}
          </button>

          {/* ⏰ RELÓGIO */}
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-xl font-black text-amber-400 font-mono">
            {agora.toLocaleTimeString('pt-BR')}
          </div>

          {/* 🖥️ FULLSCREEN */}
          <button 
            onClick={alternarFullScreen}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-black border border-slate-700 transition-all"
          >
            {isFullScreen ? '↙ SAIR' : '⛶ TELA CHEIA'}
          </button>
        </div>
      </header>

      {/* GRID DE COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        {/* COLUNA: NOVOS / ABERTOS */}
        <section className="bg-slate-900/60 border border-red-900/40 rounded-3xl p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
            <h2 className="text-lg font-black text-red-400 flex items-center gap-2 uppercase tracking-wide">
              🔴 Aguardando Atendimento {modoPlantao && <span className="text-xs bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded-lg">Fim de Semana</span>}
            </h2>
            <span className="bg-red-500 text-white font-black px-3 py-1 rounded-full text-xs">
              {abertos.length}
            </span>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 max-h-[72vh] pr-2">
            {abertos.map(c => (
              <div 
                key={c.id} 
                className={`bg-slate-900 border-l-[10px] border-red-500 border-y border-r border-slate-800/80 p-5 rounded-2xl shadow-lg relative ${
                  modoPlantao ? 'ring-2 ring-red-500/50 shadow-red-950/40' : ''
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-amber-400 font-black text-sm uppercase bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    📍 {c.setor_nome || 'Setor Geral'}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {modoPlantao && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                        🚨 Plantão
                      </span>
                    )}
                    <span className="text-slate-400 font-mono text-xs font-bold">#{c.id}</span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white leading-tight mb-2 uppercase">{c.titulo}</h3>
                <p className="text-slate-300 text-sm font-medium line-clamp-2 mb-3">{c.descricao_problema}</p>

                {c.equip_nome && (
                  <div className="bg-slate-950 p-2.5 rounded-xl text-xs text-blue-400 font-bold border border-slate-800/60 mb-3 flex items-center gap-2">
                    <span>⚙️</span>
                    <span>[{c.equip_pat}] {c.equip_nome}</span>
                  </div>
                )}

                {/* 👤 LINHA DO SOLICITANTE */}
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80 mb-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold truncate">
                    <span className="text-slate-500">👤 Solicitante:</span>
                    <span className="text-amber-300 font-black uppercase truncate">{obterSolicitante(c)}</span>
                  </div>
                  {c.categoria && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase">
                      {c.categoria}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800/60">
                  <span>Prioridade: <strong className="text-red-400">{c.prioridade || 'Média'}</strong></span>
                  <span className="text-amber-300">📅 Aberto: {formatarDiaSemana(c.data_abertura)}</span>
                </div>
              </div>
            ))}

            {abertos.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 font-bold italic py-20 gap-2">
                <span className="text-4xl">✨</span>
                <span>Nenhum chamado pendente no plantão.</span>
              </div>
            )}
          </div>
        </section>

        {/* COLUNA: EM ATENDIMENTO */}
        <section className="bg-slate-900/60 border border-amber-900/40 rounded-3xl p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2 uppercase tracking-wide">
              🟡 Em Andamento
            </h2>
            <span className="bg-amber-500 text-slate-950 font-black px-3 py-1 rounded-full text-xs">
              {emAtendimento.length}
            </span>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 max-h-[72vh] pr-2">
            {emAtendimento.map(c => (
              <div key={c.id} className="bg-slate-900 border-l-[10px] border-amber-400 border-y border-r border-slate-800/80 p-5 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-amber-300 font-black text-sm uppercase bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    📍 {c.setor_nome || 'Setor Geral'}
                  </span>
                  <span className="text-slate-400 font-mono text-xs font-bold">#{c.id}</span>
                </div>

                <h3 className="text-xl font-black text-slate-200 leading-tight mb-2 uppercase">{c.titulo}</h3>
                
                {c.equip_nome && (
                  <div className="bg-slate-950 p-2.5 rounded-xl text-xs text-blue-400 font-bold border border-slate-800/60 mb-3 flex items-center gap-2">
                    <span>⚙️</span>
                    <span>[{c.equip_pat}] {c.equip_nome}</span>
                  </div>
                )}

                {/* 👤 LINHA DO SOLICITANTE */}
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80 mb-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold truncate">
                    <span className="text-slate-500">👤 Solicitante:</span>
                    <span className="text-amber-300 font-black uppercase truncate">{obterSolicitante(c)}</span>
                  </div>
                  {c.categoria && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase">
                      {c.categoria}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800/60">
                  <span>Status: <strong className="text-amber-400">Em Atendimento</strong></span>
                  <span>📅 Aberto: {formatarDiaSemana(c.data_abertura)}</span>
                </div>
              </div>
            ))}

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
  );
};

export default PainelChamados;