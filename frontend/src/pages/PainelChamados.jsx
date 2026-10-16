import React, { useEffect, useState, useRef } from 'react';
import { 
  FiVolume2, 
  FiMic, 
  FiCheckCircle, 
  FiPlay, 
  FiRotateCcw, 
  FiX 
} from 'react-icons/fi';

const PainelChamados = () => {
  const [chamados, setChamados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [agora, setAgora] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioHabilitado, setAudioHabilitado] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // 👤 OBTÉM O USUÁRIO / TÉCNICO LOGADO NO DISPOSITIVO
  const obterUsuarioLogado = () => {
    try {
      const userStorage = localStorage.getItem('usuario') || localStorage.getItem('user');
      if (userStorage) {
        const u = JSON.parse(userStorage);
        return {
          id: u.id || null,
          nome: u.nome || 'Plantonista',
          nivel: (u.nivel || 'tecnico').toLowerCase()
        };
      }
    } catch (_) {}
    return { id: null, nome: 'Plantonista Manutenção', nivel: 'tecnico' };
  };

  const usuarioLogado = useRef(obterUsuarioLogado()).current;

  // 🌙 MODO PLANTÃO / FIM DE SEMANA (Auto-ativa se vier ?plantao=true na URL ou já estiver salvo)
  const [modoPlantao, setModoPlantao] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('plantao') === 'true') {
      localStorage.setItem('painel_modo_plantao', 'true');
      return true;
    }
    return localStorage.getItem('painel_modo_plantao') === 'true';
  });

  // ESTADO DO MODAL DE CONCLUSÃO
  const [chamadoParaConcluir, setChamadoParaConcluir] = useState(null);
  const [transcricaoVoz, setTranscricaoVoz] = useState('');
  const [gravandoVoz, setGravandoVoz] = useState(false);
  const recognitionRef = useRef(null);

  const controleAlertasRef = useRef(new Map());
  const primeiraCargaRef = useRef(true);
  const scrollContainerAbertosRef = useRef(null);
  const scrollContainerAndamentoRef = useRef(null);

  const API_URL = '/api';

  // 📍 RESOLVER CAMINHO DO SETOR
  const obterSetorCompleto = (chamado, listaSetores = setores) => {
    if (!chamado) return 'Setor Geral';
    if (chamado.setor_completo) return chamado.setor_completo;

    if (chamado.setor_id && Array.isArray(listaSetores)) {
      const setorEncontrado = listaSetores.find(s => String(s.id) === String(chamado.setor_id));
      if (setorEncontrado?.nome) return setorEncontrado.nome;
    }

    return chamado.setor_nome || 'Setor Geral';
  };

  // 🗣️ SÍNTESE DE VOZ
  const falarTexto = (texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const vozes = window.speechSynthesis.getVoices();
    const vozPt = vozes.find(v => v.lang === 'pt-BR' || v.lang.includes('pt'));
    if (vozPt) utterance.voice = vozPt;

    window.speechSynthesis.speak(utterance);
  };

  const narrarChamado = (c) => {
    if (!modoPlantao) return;
    const setor = obterSetorCompleto(c, setores).replace(/\s*>\s*/g, ', ');
    const titulo = c.titulo || 'Sem assunto';
    const equip = c.equip_nome ? `Equipamento: ${c.equip_nome}.` : '';
    const desc = c.descricao_problema ? `Detalhe: ${c.descricao_problema}.` : '';
    
    falarTexto(`Chamado no setor ${setor}. Problema: ${titulo}. ${equip} ${desc}`);
  };

  // 🔊 RECONHECIMENTO DE VOZ (DEFINITIVO PARA ANDROID / CHROME MOBILE)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0) {
        const textoFalado = event.results[0][0].transcript.trim();

        setTranscricaoVoz(prev => {
          const textoAnterior = prev.trim();
          return textoAnterior ? `${textoAnterior} ${textoFalado}` : textoFalado;
        });
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn("Erro no reconhecimento de voz:", e);
      }
      setGravandoVoz(false);
    };

    recognition.onend = () => {
      setGravandoVoz(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (_) {}
    };
  }, []);

  const alternarGravacao = () => {
    if (!recognitionRef.current) {
      alert("O navegador não suporta reconhecimento de voz.");
      return;
    }

    if (gravandoVoz) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setGravandoVoz(false);
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      try {
        recognitionRef.current.start();
        setGravandoVoz(true);
      } catch (err) {
        console.warn("Falha ao iniciar reconhecimento:", err);
        setGravandoVoz(false);
      }
    }
  };

  // ⚡ 1 CLIQUE: ATENDER COM O NOME DO TÉCNICO LOGADO
  const iniciarAtendimento = async (chamadoId) => {
    if (!modoPlantao) return;

    const nomeTecnico = usuarioLogado.nome;

    // Atualização otimista imediata na tela
    setChamados(prev => prev.map(c => {
      if (c.id === chamadoId) {
        return { 
          ...c, 
          status: 'Em Atendimento', 
          tecnico_responsavel: nomeTecnico 
        };
      }
      return c;
    }));

    falarTexto("Atendimento iniciado.");

    try {
      const res = await fetch(`${API_URL}/chamados/${chamadoId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'x-usuario-nivel': usuarioLogado.nivel || 'admin',
          'x-usuario-id': String(usuarioLogado.id || '')
        },
        body: JSON.stringify({ 
          status: 'Em Atendimento',
          tecnico_responsavel: nomeTecnico
        })
      });

      if (!res.ok) {
        console.error("Erro na API ao iniciar atendimento:", res.status);
        buscarDados();
      }
    } catch (e) {
      console.error("Erro ao iniciar atendimento:", e);
      buscarDados();
    }
  };

  // ⚡ 1 CLIQUE: CONCLUIR COM O PARECER DA VOZ
  const concluirChamado = async () => {
    if (!chamadoParaConcluir || !modoPlantao) return;

    const idConcluido = chamadoParaConcluir.id;
    const nomeTecnico = usuarioLogado.nome;
    const parecerFinal = transcricaoVoz.trim() || 'Serviço executado pelo plantonista.';

    // Atualização otimista: remove da tela na hora
    setChamados(prev => prev.filter(c => c.id !== idConcluido));
    setChamadoParaConcluir(null);
    setTranscricaoVoz('');

    falarTexto("Chamado concluído com sucesso.");

    try {
      const res = await fetch(`${API_URL}/chamados/${idConcluido}/concluir`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'x-usuario-nivel': usuarioLogado.nivel || 'admin',
          'x-usuario-id': String(usuarioLogado.id || '')
        },
        body: JSON.stringify({ 
          parecer_tecnico: parecerFinal,
          tecnico_responsavel: nomeTecnico
        })
      });

      if (!res.ok) {
        console.error("Erro na API ao concluir:", res.status);
        buscarDados();
      }
    } catch (e) {
      console.error("Erro ao concluir chamado:", e);
      buscarDados();
    }
  };

  const tocarBipe = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Áudio não pôde tocar:", e);
    }
  };

  const alternarModoPlantao = () => {
    const novoStatus = !modoPlantao;
    setModoPlantao(novoStatus);
    localStorage.setItem('painel_modo_plantao', String(novoStatus));

    if (novoStatus) {
      falarTexto("Modo fim de semana ativado.");
    } else {
      setChamadoParaConcluir(null);
      controleAlertasRef.current.clear();
      falarTexto("Modo fim de semana desativado.");
    }
  };

  const ehChamadoDoPlantao = (dataAberturaStr) => {
    if (!dataAberturaStr) return true;
    const dataAbertura = new Date(dataAberturaStr).getTime();
    const limitePlantao = Date.now() - (48 * 60 * 60 * 1000);
    return dataAbertura >= limitePlantao;
  };

  const buscarDados = async () => {
    try {
      const headers = { 
        'Content-Type': 'application/json', 
        'x-usuario-nivel': usuarioLogado.nivel || 'admin' 
      };

      const [resChamados, resSetores] = await Promise.all([
        fetch(`${API_URL}/chamados`, { headers }).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/setores`, { headers }).then(res => res.json()).catch(() => [])
      ]);

      const listaSetores = Array.isArray(resSetores) ? resSetores : [];
      setSetores(listaSetores);

      const pendentes = (Array.isArray(resChamados) ? resChamados : []).filter(c => c.status !== 'Concluído');
      const agoraMs = Date.now();
      const INTERVALO_MS = 30 * 60 * 1000;
      const MAX_ALERTAS = 3;

      const abertosValidos = pendentes.filter(c => {
        if (c.status !== 'Aberto') return false;
        if (!modoPlantao) return true;
        return ehChamadoDoPlantao(c.data_abertura);
      });

      const idsAbertos = new Set(abertosValidos.map(c => c.id));
      for (const [id] of controleAlertasRef.current.entries()) {
        if (!idsAbertos.has(id)) {
          controleAlertasRef.current.delete(id);
        }
      }

      if (!primeiraCargaRef.current && audioHabilitado) {
        abertosValidos.forEach(c => {
          const dados = controleAlertasRef.current.get(c.id);

          if (!dados) {
            controleAlertasRef.current.set(c.id, { count: 1, lastAlert: agoraMs });
            tocarBipe();
            setTimeout(() => narrarChamado(c), 600);
          } else if (dados.count < MAX_ALERTAS && (agoraMs - dados.lastAlert) >= INTERVALO_MS) {
            controleAlertasRef.current.set(c.id, { count: dados.count + 1, lastAlert: agoraMs });
            tocarBipe();
            setTimeout(() => {
              const setor = obterSetorCompleto(c, listaSetores);
              falarTexto(`Atenção: Chamado ainda aberto no setor ${setor}.`);
            }, 600);
          }
        });
      } else if (primeiraCargaRef.current) {
        abertosValidos.forEach(c => {
          controleAlertasRef.current.set(c.id, { count: 1, lastAlert: agoraMs });
        });
      }

      primeiraCargaRef.current = false;
      setChamados(pendentes);
    } catch (err) {
      console.error("Erro ao sincronizar painel:", err);
    }
  };

  useEffect(() => {
    buscarDados();
    const intervalBusca = setInterval(buscarDados, 10000);
    const intervalRelogio = setInterval(() => setAgora(new Date()), 1000);

    return () => {
      clearInterval(intervalBusca);
      clearInterval(intervalRelogio);
    };
  }, [audioHabilitado, modoPlantao]);

  useEffect(() => {
    if (!autoScroll) return;
    const scrollInterval = setInterval(() => {
      [scrollContainerAbertosRef.current, scrollContainerAndamentoRef.current].forEach(el => {
        if (!el || el.scrollHeight <= el.clientHeight) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
          el.scrollTop = 0;
        } else {
          el.scrollTop += 1;
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

  const calcularTempoDecorrido = (dataInicioStr, prioridade = 'Média') => {
    if (!dataInicioStr) return { texto: '---', atrasado: false };
    const metasHoras = { Urgente: 2, Alta: 6, 'Média': 24, Baixa: 48 };
    const metaHoras = metasHoras[prioridade] || 24;

    const inicio = new Date(dataInicioStr);
    const diffMs = agora - inicio;
    const minutosTotais = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const horasDecorridas = minutosTotais / 60;
    const horas = Math.floor(minutosTotais / 60);
    const minutos = minutosTotais % 60;

    let texto = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
    return { texto, atrasado: horasDecorridas > metaHoras };
  };

  const chamadosFiltrados = chamados.filter(c => {
    if (!modoPlantao) return true;
    return ehChamadoDoPlantao(c.data_abertura);
  });

  const totalOcultados = chamados.length - chamadosFiltrados.length;
  const abertos = chamadosFiltrados.filter(c => c.status === 'Aberto');
  const emAtendimento = chamadosFiltrados.filter(c => c.status === 'Em Atendimento');

  return (
    <div className="min-h-screen p-3 md:p-5 flex flex-col justify-between font-sans select-none bg-slate-950 text-white">
      
      <div>
        {/* BANNER INFORMATIVO SE MODO FIM DE SEMANA ESTIVER ATIVO */}
        {modoPlantao && (
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white px-4 md:px-6 py-2 rounded-2xl mb-4 font-black flex flex-wrap items-center justify-between shadow-lg text-xs md:text-sm animate-pulse">
            <div className="flex items-center gap-2">
              <span>🚨</span>
              <span>PLANTÃO ATIVO • Plantonista: <strong className="underline uppercase tracking-wide">{usuarioLogado.nome}</strong></span>
            </div>
            <div className="bg-black/30 px-3 py-0.5 rounded-xl text-xs font-mono">
              📦 {totalOcultados} chamado(s) ocultados
            </div>
          </div>
        )}

        <header className="flex flex-wrap justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-3xl mb-5 shadow-2xl gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 text-slate-950 font-black px-3.5 py-2 rounded-2xl text-xl tracking-wider shadow-md shadow-amber-500/20">
              SEC-H
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
                PAINEL DE OPERAÇÕES • MANUTENÇÃO
              </h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Hospital Domingos Lourenço • {usuarioLogado.nome}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* BOTÃO LIGA/DESLIGA FIM DE SEMANA */}
            <button
              onClick={alternarModoPlantao}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                modoPlantao 
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-300' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>{modoPlantao ? '☀️' : '🌙'}</span>
              <span>{modoPlantao ? 'DESATIVAR PLANTÃO' : 'MODO FIM DE SEMANA'}</span>
            </button>

            {/* BOTÃO DE VOZ AUTOMÁTICA */}
            <button 
              onClick={() => { 
                const novoStatus = !audioHabilitado;
                setAudioHabilitado(novoStatus); 
                if (novoStatus) falarTexto("Avisos automáticos ativados.");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                audioHabilitado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
              }`}
            >
              <span>{audioHabilitado ? '🔊 VOZ ATIVA' : '🔇 ATIVAR VOZ'}</span>
            </button>

            {/* BOTÃO AUTO-SCROLL */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 text-slate-300 border border-slate-700"
            >
              {autoScroll ? '📜 SCROLL ON' : '⏸️ PAUSADO'}
            </button>

            {/* RELÓGIO */}
            <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl text-lg font-black text-amber-400 font-mono">
              {agora.toLocaleTimeString('pt-BR')}
            </div>

            {/* FULLSCREEN */}
            <button 
              onClick={alternarFullScreen}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-black border border-slate-700"
            >
              {isFullScreen ? '↙ SAIR' : '⛶ TELA CHEIA'}
            </button>
          </div>
        </header>

        {/* COLUNAS PRINCIPAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUNA 1: VERMELHO - CHAMADOS ABERTOS */}
          <section className="bg-slate-900/60 border border-red-900/40 rounded-3xl p-4 md:p-5 flex flex-col h-[70vh]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-red-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block"></span>
                Aguardando Atendimento
              </h2>
              <span className="bg-red-500 text-white font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-red-500/30">
                {abertos.length}
              </span>
            </div>

            <div ref={scrollContainerAbertosRef} className="space-y-4 overflow-y-auto flex-1 pr-2">
              {abertos.map(c => {
                const tempo = calcularTempoDecorrido(c.data_abertura, c.prioridade);
                const setorExibicao = obterSetorCompleto(c, setores);

                return (
                  <div 
                    key={c.id} 
                    className="bg-slate-900 border-l-[10px] border-red-500 border-y border-r border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-amber-400 font-black text-xs uppercase bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 truncate">
                        📍 {setorExibicao}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono border ${
                          tempo.atrasado ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}>
                          ⏱️ {tempo.texto}
                        </span>
                        <span className="text-slate-500 font-mono text-xs font-bold">#{c.id}</span>
                      </div>
                    </div>

                    <h3 className="text-base md:text-lg font-black text-white leading-tight uppercase">{c.titulo}</h3>
                    <p className="text-slate-300 text-xs font-medium leading-relaxed">{c.descricao_problema}</p>

                    {/* BOTÕES DE ACESSIBILIDADE CONDICIONADOS AO MODO FIM DE SEMANA */}
                    {modoPlantao && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => narrarChamado(c)}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 shadow-sm cursor-pointer"
                        >
                          <FiVolume2 className="w-4 h-4 text-amber-400" />
                          OUVIR
                        </button>

                        <button
                          type="button"
                          onClick={() => iniciarAtendimento(c.id)}
                          className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          <FiPlay className="w-4 h-4" />
                          ATENDER
                        </button>
                      </div>
                    )}
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

          {/* COLUNA 2: AMARELO - EM ATENDIMENTO */}
          <section className="bg-slate-900/60 border border-amber-900/40 rounded-3xl p-4 md:p-5 flex flex-col h-[70vh]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                Em Atendimento
              </h2>
              <span className="bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-amber-500/30">
                {emAtendimento.length}
              </span>
            </div>

            <div ref={scrollContainerAndamentoRef} className="space-y-4 overflow-y-auto flex-1 pr-2">
              {emAtendimento.map(c => {
                const tempo = calcularTempoDecorrido(c.data_abertura, c.prioridade);
                const setorExibicao = obterSetorCompleto(c, setores);

                return (
                  <div key={c.id} className="bg-slate-900 border-l-[10px] border-amber-400 border-y border-r border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-amber-300 font-black text-xs uppercase bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 truncate">
                        📍 {setorExibicao}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono bg-slate-950 text-slate-300 border border-slate-800">
                          ⏱️ {tempo.texto}
                        </span>
                        <span className="text-slate-500 font-mono text-xs font-bold">#{c.id}</span>
                      </div>
                    </div>

                    <h3 className="text-base md:text-lg font-black text-slate-100 leading-tight uppercase">{c.titulo}</h3>
                    
                    {/* BOTÕES DE ACESSIBILIDADE CONDICIONADOS AO MODO FIM DE SEMANA */}
                    {modoPlantao && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => narrarChamado(c)}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 shadow-sm cursor-pointer"
                        >
                          <FiVolume2 className="w-4 h-4 text-amber-400" />
                          RELEMBRAR
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setChamadoParaConcluir(c);
                            setTranscricaoVoz('');
                          }}
                          className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                        >
                          <FiCheckCircle className="w-4 h-4" />
                          CONCLUIR
                        </button>
                      </div>
                    )}
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

      {/* FOOTER */}
      <footer className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 font-bold">
        <div className="flex items-center gap-4">
          <span>Abertos: <strong className="text-red-400">{abertos.length}</strong></span>
          <span>•</span>
          <span>Em Curso: <strong className="text-amber-400">{emAtendimento.length}</strong></span>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
          SEC-H • Hospital Domingos Lourenço
        </div>
      </footer>

      {/* 🟢 MODAL DE RESOLUÇÃO POR VOZ */}
      {modoPlantao && chamadoParaConcluir && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-white shadow-2xl relative">
            
            <button
              onClick={() => setChamadoParaConcluir(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">
                Finalizar OS #{chamadoParaConcluir.id}
              </span>
              <h2 className="text-lg md:text-xl font-black">O que você fez no local?</h2>
            </div>

            {/* BOTÃO CENTRAL DE GRAVAÇÃO */}
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={alternarGravacao}
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all shadow-2xl cursor-pointer ${
                  gravandoVoz 
                    ? 'bg-red-600 scale-105 animate-pulse ring-8 ring-red-500/30 text-white' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <FiMic className="w-10 h-10" />
                <span className="text-[10px] font-black uppercase">{gravandoVoz ? 'Gravando...' : 'Aperte e Fale'}</span>
              </button>
              <p className="text-xs text-slate-400 text-center">
                {gravandoVoz ? 'Ouvindo... aperte de novo para pausar' : 'Toque para ditar o que foi consertado'}
              </p>
            </div>

            {/* TEXTO TRANSCRITO */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 min-h-[80px]">
              <p className="text-xs md:text-sm text-slate-200 leading-relaxed italic">
                {transcricaoVoz || "Sua fala aparecerá escrita aqui..."}
              </p>

              {transcricaoVoz && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => falarTexto(`Você disse: ${transcricaoVoz}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    <FiVolume2 className="w-4 h-4" />
                    Ouvir o que falei
                  </button>
                  <button
                    type="button"
                    onClick={() => setTranscricaoVoz('')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-rose-400 text-xs font-bold ml-auto cursor-pointer"
                  >
                    <FiRotateCcw className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {/* CONFIRMAÇÃO EM VERDE */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setChamadoParaConcluir(null)}
                className="py-3 px-4 rounded-xl text-slate-400 bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={concluirChamado}
                className="py-3 px-4 rounded-xl text-slate-950 bg-emerald-400 hover:bg-emerald-300 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <FiCheckCircle className="w-5 h-5" />
                SALVAR E CONCLUIR
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PainelChamados;