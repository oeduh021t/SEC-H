import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiVolume2, 
  FiMic, 
  FiCheckCircle, 
  FiPlay, 
  FiRotateCcw, 
  FiX,
  FiCamera,
  FiImage,
  FiTrash2,
  FiCalendar,
  FiAlertTriangle
} from 'react-icons/fi';

const PainelChamados = () => {
  const navigate = useNavigate();

  const [chamados, setChamados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [agora, setAgora] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioHabilitado, setAudioHabilitado] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [usuarioPausouHover, setUsuarioPausouHover] = useState(false);

  // 📱 ABA ATIVA NO CELULAR ('abertos' ou 'atendimento')
  const [abaMobile, setAbaMobile] = useState('abertos');

  // 📅 ALERTA DE MANUTENÇÃO PLANEJADA (POPUP DE 5 MINUTOS)
  const [planejadasAlerta, setPlanejadasAlerta] = useState([]);
  const [alertaPlanejadaAtivo, setAlertaPlanejadaAtivo] = useState(null);
  const alertasPlanejadosIgnoradosRef = useRef(new Set());

  // 👤 USUÁRIO LOGADO
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

  // 🌙 MODO PLANTÃO / FIM DE SEMANA
  const [modoPlantao, setModoPlantao] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('plantao') === 'true') {
      localStorage.setItem('painel_modo_plantao', 'true');
      return true;
    }
    return localStorage.getItem('painel_modo_plantao') === 'true';
  });

  // ESTADOS DO MODAL DE CONCLUSÃO
  const [chamadoParaConcluir, setChamadoParaConcluir] = useState(null);
  const [descricaoSolucao, setDescricaoSolucao] = useState('');
  const [gravandoVoz, setGravandoVoz] = useState(false);
  const [fotoConclusao, setFotoConclusao] = useState(null);
  const [enviandoConclusao, setEnviandoConclusao] = useState(false);

  // 📷 CÂMERA AO VIVO EMBUTIDA
  const [modalCameraAoVivo, setModalCameraAoVivo] = useState(false);
  const [carregandoCamera, setCarregandoCamera] = useState(false);
  const videoAoVivoRef = useRef(null);
  const streamAoVivoRef = useRef(null);
  const fileInputGaleriaRef = useRef(null);

  const recognitionRef = useRef(null);
  const controleAlertasRef = useRef(new Map());
  const primeiraCargaRef = useRef(true);
  const scrollContainerAbertosRef = useRef(null);
  const scrollContainerAndamentoRef = useRef(null);

  // 🛡️ REFS DO SISTEMA DE PERSISTÊNCIA (VOZ, ÁUDIO E WAKELOCK)
  const utteranceAtivaRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSilenciosoRef = useRef(null);
  const watchdogVozRef = useRef(null);

  const API_URL = '/api';

  // 🖥️ MANTER A TELA LIGADA (KIOSK / MONITORAMENTO)
  useEffect(() => {
    let wakeLock = null;

    const solicitarWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (_) {}
      }
    };

    solicitarWakeLock();
    document.addEventListener('visibilitychange', solicitarWakeLock);

    return () => {
      document.removeEventListener('visibilitychange', solicitarWakeLock);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // 🔊 HEARTBEAT DE ÁUDIO (IMPEDE O CHROME DE SUSPENDER A ABA E A ENGINE DE FALA)
  const manterAudioVivo = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtxClass();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      if (!audioSilenciosoRef.current) {
        const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        audioSilenciosoRef.current = source;
      }
    } catch (e) {
      console.warn("Falha ao manter áudio vivo:", e);
    }
  }, []);

  const obterSetorCompleto = useCallback((chamado, listaSetores = setores) => {
    if (!chamado) return 'Setor Geral';
    if (chamado.setor_completo) return chamado.setor_completo;

    if (chamado.setor_id && Array.isArray(listaSetores)) {
      const setorEncontrado = listaSetores.find(s => String(s.id) === String(chamado.setor_id));
      if (setorEncontrado?.nome) return setorEncontrado.nome;
    }

    return chamado.setor_nome || 'Setor Geral';
  }, [setores]);

  // 🗣️ SÍNTESE DE VOZ BLINDADA CONTRA SUSPENSÃO E GARBAGE COLLECTION
  const falarTexto = useCallback((texto) => {
    if (!('speechSynthesis' in window)) return;

    try {
      manterAudioVivo();

      if (watchdogVozRef.current) clearInterval(watchdogVozRef.current);

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const vozes = window.speechSynthesis.getVoices();
      const vozPt = vozes.find(v => v.lang === 'pt-BR' || v.lang.includes('pt'));
      if (vozPt) utterance.voice = vozPt;

      utteranceAtivaRef.current = utterance;

      watchdogVozRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(watchdogVozRef.current);
        }
      }, 7000);

      utterance.onend = () => {
        clearInterval(watchdogVozRef.current);
        utteranceAtivaRef.current = null;
      };

      utterance.onerror = () => {
        clearInterval(watchdogVozRef.current);
        utteranceAtivaRef.current = null;
      };

      setTimeout(() => {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (e) {
      console.warn("Falha na síntese de voz:", e);
    }
  }, [manterAudioVivo]);

  const narrarChamado = useCallback((c) => {
    const setor = obterSetorCompleto(c, setores).replace(/\s*>\s*/g, ', ');
    const titulo = c.titulo || 'Sem assunto';
    const equip = c.equip_nome ? `Equipamento: ${c.equip_nome}.` : '';
    const desc = c.descricao_problema ? `Detalhe: ${c.descricao_problema}.` : '';
    falarTexto(`Chamado no setor ${setor}. Problema: ${titulo}. ${equip} ${desc}`);
  }, [obterSetorCompleto, setores, falarTexto]);

  // 🔊 RECONHECIMENTO DE VOZ
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
        setDescricaoSolucao(prev => {
          const anterior = prev.trim();
          return anterior ? `${anterior} ${textoFalado}` : textoFalado;
        });
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn("Erro no microfone:", e);
      setGravandoVoz(false);
    };

    recognition.onend = () => setGravandoVoz(false);
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

  // 📷 MÉTODOS DE CÂMERA EMBUTIDA
  const abrirCameraEmbutida = async () => {
    setCarregandoCamera(true);
    setModalCameraAoVivo(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamAoVivoRef.current = stream;
      if (videoAoVivoRef.current) {
        videoAoVivoRef.current.srcObject = stream;
        await videoAoVivoRef.current.play();
      }
    } catch (err) {
      console.error("Erro câmera:", err);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      fecharCameraEmbutida();
    } finally {
      setCarregandoCamera(false);
    }
  };

  const fecharCameraEmbutida = () => {
    if (streamAoVivoRef.current) {
      streamAoVivoRef.current.getTracks().forEach(t => t.stop());
      streamAoVivoRef.current = null;
    }
    setModalCameraAoVivo(false);
    setCarregandoCamera(false);
  };

  const capturarFotoCanvas = () => {
    if (!videoAoVivoRef.current) return;
    const video = videoAoVivoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const arquivoFoto = new File([blob], `conclusao_${chamadoParaConcluir?.id}_${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      setFotoConclusao(arquivoFoto);
      fecharCameraEmbutida();
    }, 'image/jpeg', 0.85);
  };

  const comprimirImagem = async (arquivo) => {
    if (!arquivo || !arquivo.type.startsWith('image/')) return arquivo;
    return new Promise((resolve) => {
      const leitor = new FileReader();
      leitor.readAsDataURL(arquivo);
      leitor.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          let largura = img.width;
          let altura = img.height;
          const MAX = 1600;
          if (largura > altura && largura > MAX) {
            altura *= MAX / largura;
            largura = MAX;
          } else if (altura > MAX) {
            largura *= MAX / altura;
            altura = MAX;
          }
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, largura, altura);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(arquivo);
            resolve(new File([blob], arquivo.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(arquivo);
      };
      leitor.onerror = () => resolve(arquivo);
    });
  };

  const injetarTextoRapido = (txt) => {
    setDescricaoSolucao(prev => prev ? `${prev}. ${txt}` : txt);
  };

  const tocarBipe = useCallback(() => {
    try {
      manterAudioVivo();

      const audioCtx = audioContextRef.current;
      if (!audioCtx) return;

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
  }, [manterAudioVivo]);

  // ⚡ ATENDER
  const iniciarAtendimento = async (chamadoId) => {
    const nomeTecnico = usuarioLogado.nome;

    setChamados(prev => prev.map(c => {
      if (c.id === chamadoId) {
        return { ...c, status: 'Em Atendimento', tecnico_responsavel: nomeTecnico };
      }
      return c;
    }));

    falarTexto("Atendimento iniciado.");

    try {
      await fetch(`${API_URL}/chamados/${chamadoId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'x-usuario-nivel': usuarioLogado.nivel || 'admin',
          'x-usuario-id': String(usuarioLogado.id || '')
        },
        body: JSON.stringify({ status: 'Em Atendimento', tecnico_responsavel: nomeTecnico })
      });
    } catch (e) {
      console.error("Erro ao iniciar atendimento:", e);
      buscarDados();
    }
  };

  // ⚡ CONCLUIR COM TEXTO / VOZ / FOTO
  const concluirChamado = async () => {
    if (!chamadoParaConcluir) return;

    setEnviandoConclusao(true);
    const idConcluido = chamadoParaConcluir.id;
    const nomeTecnico = usuarioLogado.nome || 'Plantonista';
    const parecerFinal = descricaoSolucao.trim() || 'Serviço executado pelo plantonista.';

    const formData = new FormData();
    formData.append('status', 'Concluído');
    formData.append('tipo_atendimento', 'Interno');
    formData.append('descricao_solucao', parecerFinal);
    formData.append('parecer_tecnico', parecerFinal);
    formData.append('tecnico_responsavel', nomeTecnico);
    formData.append('registrado_por_nome', nomeTecnico);
    formData.append('registrado_por_id', usuarioLogado.id || '');

    if (fotoConclusao) {
      const fotoFinal = await comprimirImagem(fotoConclusao);
      formData.append('foto_conclusao', fotoFinal);
    }

    setChamados(prev => prev.filter(c => c.id !== idConcluido));
    setChamadoParaConcluir(null);
    setDescricaoSolucao('');
    setFotoConclusao(null);

    falarTexto("Chamado concluído com sucesso.");

    try {
      const res = await fetch(`${API_URL}/chamados/${idConcluido}/atualizar`, {
        method: 'PUT',
        headers: { 
          'x-usuario-nivel': usuarioLogado.nivel || 'admin',
          'x-usuario-id': String(usuarioLogado.id || '')
        },
        body: formData
      });

      if (!res.ok) {
        await fetch(`${API_URL}/chamados/${idConcluido}/concluir`, {
          method: 'PUT',
          headers: { 
            'x-usuario-nivel': usuarioLogado.nivel || 'admin',
            'x-usuario-id': String(usuarioLogado.id || '')
          },
          body: formData
        });
      }
    } catch (e) {
      console.error("Erro ao concluir chamado:", e);
      buscarDados();
    } finally {
      setEnviandoConclusao(false);
    }
  };

  const alternarModoPlantao = () => {
    const novoStatus = !modoPlantao;
    setModoPlantao(novoStatus);
    localStorage.setItem('painel_modo_plantao', String(novoStatus));
    falarTexto(novoStatus ? "Modo fim de semana ativado." : "Modo fim de semana desativado.");
  };

  const ehChamadoDoPlantao = (dataAberturaStr) => {
    if (!dataAberturaStr) return true;
    const dataAbertura = new Date(dataAberturaStr).getTime();
    return dataAbertura >= Date.now() - (48 * 60 * 60 * 1000);
  };

  // 🔔 DISPARAR OS DIRETO DO POPUP DE PLANEJADA
  const handleGerarOSPlanejada = async (planejamento) => {
    try {
      const res = await fetch(`${API_URL}/manutencoes-planejadas/${planejamento.id}/gerar-os`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': usuarioLogado.nivel || 'admin'
        },
        body: JSON.stringify({ usuario_id: usuarioLogado.id || 1 })
      });

      const data = await res.json();
      if (res.ok && data.chamado_id) {
        setAlertaPlanejadaAtivo(null);
        falarTexto("Ordem de serviço gerada a partir do planejamento.");
        navigate(`/chamados/${data.chamado_id}/tratar`);
      } else {
        alert(data.error || "Erro ao converter planejamento em OS.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao gerar OS.");
    }
  };

  // ⏰ VERIFICAÇÃO DO POPUP DE 5 MINUTOS DAS PLANEJADAS
  const checarAlertaCincoMinutos = useCallback((listaPlanejadas) => {
    if (!Array.isArray(listaPlanejadas) || listaPlanejadas.length === 0) return;

    const agoraDate = new Date();
    const agoraMinutosDia = (agoraDate.getHours() * 60) + agoraDate.getMinutes();

    for (const plan of listaPlanejadas) {
      if (plan.status !== 'Agendado' && plan.status !== 'Pendente') continue;
      if (plan.chamado_execucao_id) continue;
      if (alertasPlanejadosIgnoradosRef.current.has(plan.id)) continue;

      let deveDisparar = false;

      if (plan.hora_programada) {
        const [h, m] = plan.hora_programada.split(':').map(Number);
        const minutosPlanejados = (h * 60) + m;
        const diffMinutos = minutosPlanejados - agoraMinutosDia;

        if (diffMinutos <= 5) {
          deveDisparar = true;
        }
      } else {
        deveDisparar = true;
      }

      if (deveDisparar) {
        setAlertaPlanejadaAtivo(plan);
        if (audioHabilitado) {
          tocarBipe();
          setTimeout(() => {
            falarTexto(`Aviso de manutenção planejada para o setor ${plan.setor_nome || 'Geral'}. Ativo: ${plan.equipamento_nome || 'não informado'}.`);
          }, 600);
        }
        break;
      }
    }
  }, [audioHabilitado, falarTexto, tocarBipe]);

  const buscarDados = useCallback(async () => {
    try {
      const headers = { 
        'Content-Type': 'application/json', 
        'x-usuario-nivel': usuarioLogado.nivel || 'admin' 
      };

      const [resChamados, resSetores, resPlanejadas] = await Promise.all([
        fetch(`${API_URL}/chamados`, { headers }).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/setores`, { headers }).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/manutencoes-planejadas/alertas-hoje`, { headers }).then(res => res.json()).catch(() => [])
      ]);

      const listaSetores = Array.isArray(resSetores) ? resSetores : [];
      setSetores(listaSetores);

      const listaPlan = Array.isArray(resPlanejadas) ? resPlanejadas : [];
      setPlanejadasAlerta(listaPlan);
      checarAlertaCincoMinutos(listaPlan);

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
        if (!idsAbertos.has(id)) controleAlertasRef.current.delete(id);
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
  }, [audioHabilitado, modoPlantao, usuarioLogado.nivel, checarAlertaCincoMinutos, tocarBipe, narrarChamado, obterSetorCompleto, falarTexto]);

  useEffect(() => {
    buscarDados();
    const intervalBusca = setInterval(buscarDados, 10000);
    const intervalRelogio = setInterval(() => setAgora(new Date()), 1000);

    return () => {
      clearInterval(intervalBusca);
      clearInterval(intervalRelogio);
    };
  }, [buscarDados]);

  // 📜 ROLAGEM AUTOMÁTICA CONTÍNUA (SEM REQUESTANIMATIONFRAME, TOLERANTE A ESCALA E EM SEGUNDO PLANO)
  useEffect(() => {
    if (!autoScroll || usuarioPausouHover) return;

    let subPixelAbertos = 0;
    let subPixelAndamento = 0;
    const VELOCIDADE_PX = 0.8;

    const timerScroll = setInterval(() => {
      // 1. Coluna Abertos
      const elAbertos = scrollContainerAbertosRef.current;
      if (elAbertos) {
        const maxScroll = elAbertos.scrollHeight - elAbertos.clientHeight;
        if (maxScroll > 10) {
          if (elAbertos.scrollTop >= maxScroll - 15) {
            elAbertos.scrollTop = 0;
            subPixelAbertos = 0;
          } else {
            subPixelAbertos += VELOCIDADE_PX;
            if (subPixelAbertos >= 1) {
              elAbertos.scrollTop += Math.floor(subPixelAbertos);
              subPixelAbertos -= Math.floor(subPixelAbertos);
            }
          }
        }
      }

      // 2. Coluna Em Atendimento
      const elAndamento = scrollContainerAndamentoRef.current;
      if (elAndamento) {
        const maxScroll = elAndamento.scrollHeight - elAndamento.clientHeight;
        if (maxScroll > 10) {
          if (elAndamento.scrollTop >= maxScroll - 15) {
            elAndamento.scrollTop = 0;
            subPixelAndamento = 0;
          } else {
            subPixelAndamento += VELOCIDADE_PX;
            if (subPixelAndamento >= 1) {
              elAndamento.scrollTop += Math.floor(subPixelAndamento);
              subPixelAndamento -= Math.floor(subPixelAndamento);
            }
          }
        }
      }
    }, 30);

    return () => clearInterval(timerScroll);
  }, [autoScroll, usuarioPausouHover, chamados]);

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
        {/* BANNER MODO PLANTÃO */}
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

            <button 
              onClick={() => { 
                const novoStatus = !audioHabilitado;
                setAudioHabilitado(novoStatus); 
                if (novoStatus) {
                  manterAudioVivo();
                  tocarBipe();
                  falarTexto("Avisos automáticos ativados.");
                } else if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                audioHabilitado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
              }`}
            >
              <span>{audioHabilitado ? '🔊 VOZ ATIVA' : '🔇 ATIVAR VOZ'}</span>
            </button>

            <button 
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                autoScroll ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {autoScroll ? '📜 ROLAGEM: LIGADA' : '⏸️ ROLAGEM: DESLIGADA'}
            </button>

            <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl text-lg font-black text-amber-400 font-mono">
              {agora.toLocaleTimeString('pt-BR')}
            </div>

            <button 
              onClick={alternarFullScreen}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-black border border-slate-700 cursor-pointer"
            >
              {isFullScreen ? '↙ SAIR' : '⛶ TELA CHEIA'}
            </button>
          </div>
        </header>

        {/* 📱 SELETOR DE ABAS MOBILE */}
        <div className="grid grid-cols-2 gap-2 mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setAbaMobile('abertos')}
            className={`py-3 px-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              abaMobile === 'abertos'
                ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/30 ring-2 ring-red-400/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${abaMobile === 'abertos' ? 'bg-white animate-ping' : 'bg-red-500'} inline-block`}></span>
            <span>Aguardando</span>
            <span className="bg-black/40 px-2 py-0.5 rounded-full text-[11px] font-mono">
              {abertos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaMobile('atendimento')}
            className={`py-3 px-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              abaMobile === 'atendimento'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            <span>Em Atendimento</span>
            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[11px] font-mono">
              {emAtendimento.length}
            </span>
          </button>
        </div>

        {/* COLUNAS PRINCIPAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA 1: ABERTOS */}
          <section className={`bg-slate-900/60 border border-red-900/40 rounded-3xl p-4 md:p-5 flex-col h-[75vh] ${
            abaMobile !== 'abertos' ? 'hidden lg:flex' : 'flex'
          }`}>
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-red-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block"></span>
                Aguardando Atendimento
              </h2>
              <span className="bg-red-500 text-white font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-red-500/30">
                {abertos.length}
              </span>
            </div>

            <div 
              ref={scrollContainerAbertosRef} 
              onMouseEnter={() => setUsuarioPausouHover(true)}
              onMouseLeave={() => setUsuarioPausouHover(false)}
              onTouchStart={() => setUsuarioPausouHover(true)}
              onTouchEnd={() => setUsuarioPausouHover(false)}
              className="space-y-4 overflow-y-auto flex-1 pr-2"
            >
              {abertos.map(c => {
                const tempo = calcularTempoDecorrido(c.data_abertura, c.prioridade);
                const setorExibicao = obterSetorCompleto(c, setores);

                return (
                  <div key={c.id} className="bg-slate-900 border-l-[10px] border-red-500 border-y border-r border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl space-y-3">
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

          {/* COLUNA 2: EM ATENDIMENTO */}
          <section className={`bg-slate-900/60 border border-amber-900/40 rounded-3xl p-4 md:p-5 flex-col h-[75vh] ${
            abaMobile !== 'atendimento' ? 'hidden lg:flex' : 'flex'
          }`}>
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-base font-black text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                Em Atendimento
              </h2>
              <span className="bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-full text-xs shadow-md shadow-amber-500/30">
                {emAtendimento.length}
              </span>
            </div>

            <div 
              ref={scrollContainerAndamentoRef} 
              onMouseEnter={() => setUsuarioPausouHover(true)}
              onMouseLeave={() => setUsuarioPausouHover(false)}
              onTouchStart={() => setUsuarioPausouHover(true)}
              onTouchEnd={() => setUsuarioPausouHover(false)}
              className="space-y-4 overflow-y-auto flex-1 pr-2"
            >
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
                          setDescricaoSolucao(c.descricao_solucao || '');
                          setFotoConclusao(null);
                        }}
                        className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        CONCLUIR
                      </button>
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

      {/* FOOTER */}
      <footer className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 font-bold">
        <div className="flex items-center gap-4">
          <span>Abertos: <strong className="text-red-400">{abertos.length}</strong></span>
          <span>•</span>
          <span>Em Curso: <strong className="text-amber-400">{emAtendimento.length}</strong></span>
          {planejadasAlerta.length > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-400">Planejadas Hoje: <strong>{planejadasAlerta.length}</strong></span>
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
          SEC-H • Hospital Domingos Lourenço
        </div>
      </footer>

      {/* 🚨 POPUP PRIORITÁRIO: AVISO DE MANUTENÇÃO PLANEJADA */}
      {alertaPlanejadaAtivo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl w-full max-w-lg p-6 space-y-4 text-white shadow-2xl relative shadow-amber-500/20">
            <button
              onClick={() => {
                alertasPlanejadosIgnoradosRef.current.add(alertaPlanejadaAtivo.id);
                setAlertaPlanejadaAtivo(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 cursor-pointer"
              title="Fechar lembrete"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40 animate-bounce">
                <FiAlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">
                  Aviso de Manutenção Planejada
                </span>
                <h3 className="text-lg font-black text-white leading-tight uppercase mt-0.5">
                  {alertaPlanejadaAtivo.titulo}
                </h3>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>📍 Local / Setor:</span>
                <strong className="text-white font-black">{alertaPlanejadaAtivo.setor_nome || 'Geral'}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>🤖 Ativo / Equipamento:</span>
                <strong className="text-amber-300 font-bold">
                  {alertaPlanejadaAtivo.equipamento_nome || 'Infraestrutura'} 
                  {alertaPlanejadaAtivo.equipamento_patrimonio ? ` (Pat: ${alertaPlanejadaAtivo.equipamento_patrimonio})` : ''}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>⏰ Horário Programado:</span>
                <span className="font-mono bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-lg font-black border border-amber-500/30">
                  {alertaPlanejadaAtivo.hora_programada ? `${alertaPlanejadaAtivo.hora_programada.slice(0, 5)} (Janela Operacional)` : 'Agendado para Hoje'}
                </span>
              </div>
              {alertaPlanejadaAtivo.motivo_janela && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-black text-amber-500 uppercase block">Motivo da Janela:</span>
                  <p className="text-slate-300 italic text-[11px] mt-0.5">{alertaPlanejadaAtivo.motivo_janela}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  alertasPlanejadosIgnoradosRef.current.add(alertaPlanejadaAtivo.id);
                  setAlertaPlanejadaAtivo(null);
                }}
                className="py-3 px-4 rounded-xl text-slate-400 bg-slate-800 hover:bg-slate-700 font-black text-xs uppercase cursor-pointer transition-all"
              >
                Lembrar Depois
              </button>

              <button
                type="button"
                onClick={() => handleGerarOSPlanejada(alertaPlanejadaAtivo)}
                className="py-3 px-4 rounded-xl text-slate-950 bg-amber-400 hover:bg-amber-300 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer active:scale-95 transition-all"
              >
                <FiPlay className="w-4 h-4" />
                <span>Iniciar / Gerar OS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL DE RESOLUÇÃO */}
      {chamadoParaConcluir && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-5 md:p-6 space-y-5 text-white shadow-2xl relative my-auto">
            <button
              onClick={() => {
                setChamadoParaConcluir(null);
                setFotoConclusao(null);
                setDescricaoSolucao('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>

            <div>
              <span className="text-emerald-400 font-black text-xs uppercase tracking-wider block">
                Finalizar OS #{chamadoParaConcluir.id}
              </span>
              <h2 className="text-lg md:text-xl font-black text-slate-100">
                {chamadoParaConcluir.titulo}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                📍 {obterSetorCompleto(chamadoParaConcluir, setores)}
              </p>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={alternarGravacao}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shrink-0 ${
                    gravandoVoz 
                      ? 'bg-red-600 animate-pulse ring-4 ring-red-500/30 text-white' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title={gravandoVoz ? "Parar gravação" : "Gravar com a voz"}
                >
                  <FiMic className="w-6 h-6" />
                </button>
                <div>
                  <span className="text-xs font-black uppercase text-slate-200 block">
                    {gravandoVoz ? '🔴 Gravando sua voz...' : 'Ditar por Voz'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {gravandoVoz ? 'Fale normalmente no celular' : 'Toque no microfone ou digite abaixo'}
                  </p>
                </div>
              </div>

              {descricaoSolucao && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => falarTexto(`Você ditou: ${descricaoSolucao}`)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold cursor-pointer"
                    title="Ouvir o parecer"
                  >
                    <FiVolume2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescricaoSolucao('')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold cursor-pointer"
                    title="Limpar texto"
                  >
                    <FiRotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                Inserções Rápidas (1 clique):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => injetarTextoRapido("Realizada limpeza técnica e testes operacionais")}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-bold text-left transition-colors cursor-pointer"
                >
                  💧 Limpeza e testes
                </button>
                <button
                  type="button"
                  onClick={() => injetarTextoRapido("Substituição de componente avariado e liberado")}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-bold text-left transition-colors cursor-pointer"
                >
                  🔄 Troca de peça
                </button>
                <button
                  type="button"
                  onClick={() => injetarTextoRapido("Equipamento testado e entregue em pleno funcionamento")}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-bold text-left transition-colors cursor-pointer"
                >
                  ✅ Testado e Ok
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Parecer Técnico do Conserto (Voz ou Digitação) *
              </label>
              <textarea
                rows={3}
                value={descricaoSolucao}
                onChange={(e) => setDescricaoSolucao(e.target.value)}
                placeholder="Descreva o que foi realizado ou use o microfone acima..."
                className="w-full p-3 bg-slate-950 border-2 border-slate-800 focus:border-emerald-500 rounded-2xl text-xs font-medium text-slate-200 outline-none resize-none transition-all"
              />
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                📷 Foto de Evidência / Conclusão (Opcional)
              </span>

              <input
                ref={fileInputGaleriaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const comprimido = await comprimirImagem(file);
                    setFotoConclusao(comprimido);
                  }
                }}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={abrirCameraEmbutida}
                  className="flex-1 py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FiCamera className="w-4 h-4" />
                  {fotoConclusao ? 'Tirar Outra Foto' : 'Câmera'}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputGaleriaRef.current?.click()}
                  className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FiImage className="w-4 h-4" />
                  Galeria
                </button>

                {fotoConclusao && (
                  <button
                    type="button"
                    onClick={() => setFotoConclusao(null)}
                    className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black hover:bg-rose-500/30 transition-all cursor-pointer"
                    title="Remover foto"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {fotoConclusao && (
                <div className="flex items-center gap-2.5 p-2 bg-slate-900 rounded-xl border border-emerald-500/40">
                  <img
                    src={URL.createObjectURL(fotoConclusao)}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-200 block truncate">
                      {fotoConclusao.name}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold block">
                      ✓ Foto pronta para salvar
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={enviandoConclusao}
                onClick={() => {
                  setChamadoParaConcluir(null);
                  setFotoConclusao(null);
                  setDescricaoSolucao('');
                }}
                className="py-3.5 px-4 rounded-xl text-slate-400 bg-slate-800 hover:bg-slate-700 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={enviandoConclusao}
                onClick={concluirChamado}
                className="py-3.5 px-4 rounded-xl text-slate-950 bg-emerald-400 hover:bg-emerald-300 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                {enviandoConclusao ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <FiCheckCircle className="w-5 h-5" />
                    <span>Salvar e Concluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📷 MODAL CÂMERA AO VIVO */}
      {modalCameraAoVivo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col justify-between p-4 animate-in fade-in duration-150">
          <div className="flex justify-between items-center text-white pb-2 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              Foto da Evidência • OS #{chamadoParaConcluir?.id}
            </span>
            <button
              type="button"
              onClick={fecharCameraEmbutida}
              className="p-2 text-slate-400 hover:text-white text-base font-black uppercase cursor-pointer"
            >
              ✕ Fechar
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center my-3 rounded-2xl overflow-hidden bg-black border border-slate-800">
            {carregandoCamera && (
              <div className="text-slate-400 text-xs font-bold uppercase animate-pulse">
                Iniciando câmera...
              </div>
            )}
            <video
              ref={videoAoVivoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex justify-around items-center pt-2">
            <button
              type="button"
              onClick={fecharCameraEmbutida}
              className="px-5 py-3 rounded-2xl bg-slate-800 text-white text-xs font-black uppercase cursor-pointer"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={capturarFotoCanvas}
              disabled={carregandoCamera}
              className="w-20 h-20 bg-white rounded-full border-4 border-emerald-500 flex items-center justify-center shadow-2xl active:scale-90 transition-all text-2xl cursor-pointer disabled:opacity-50"
              title="Tirar foto agora"
            >
              📸
            </button>

            <div className="w-16"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PainelChamados;