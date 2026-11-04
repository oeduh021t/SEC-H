import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Metrologia = () => {
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('todos');
  const [carregando, setCarregando] = useState(true);

  // Modal de Lançar Certificado / Calibração
  const [modalAberta, setModalAberta] = useState(false);
  const [ativoSelecionado, setAtivoSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Modal de Histórico de Laudos do Equipamento
  const [modalHistoricoAberta, setModalHistoricoAberta] = useState(false);
  const [historicoCalibracoes, setHistoricoCalibracoes] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Formulário de Baixa / Novo Laudo
  const formInicial = {
    numero_certificado: '',
    orgao_laboratorio: '',
    data_calibracao: new Date().toISOString().split('T')[0],
    data_validade: '',
    resultado_parecer: 'Aprovado',
    erro_maximo_encontrado: '',
    incerteza_medicao: '',
    observacoes: '',
    tecnico_responsavel: ''
  };
  const [form, setForm] = useState(formInicial);
  const [arquivoPdf, setArquivoPdf] = useState(null);

  const API_URL = '/api';
  const BASE_URL = '';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const obterNomeUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nome : 'Técnico Responsável';
  };

  const carregarCronograma = () => {
    setCarregando(true);
    fetch(`${API_URL}/calibracoes`, {
      headers: { 'x-usuario-nivel': obterNivelUsuario() }
    })
      .then(res => res.json())
      .then(data => {
        setItens(Array.isArray(data) ? data : []);
        setCarregando(false);
      })
      .catch(err => {
        console.error('Erro ao buscar calibrações:', err);
        setCarregando(false);
      });
  };

  useEffect(() => {
    carregarCronograma();
  }, []);

  // Abrir Modal para Lançar Novo Certificado
  const abrirModalBaixa = (equip) => {
    setAtivoSelecionado(equip);
    const hoje = new Date();
    const meses = equip.periodicidade_calibracao_meses || 12;
    const proxAno = new Date(hoje);
    proxAno.setMonth(proxAno.getMonth() + meses);

    setForm({
      ...formInicial,
      data_validade: proxAno.toISOString().split('T')[0],
      tecnico_responsavel: obterNomeUsuario()
    });
    setArquivoPdf(null);
    setModalAberta(true);
  };

  // Abrir Histórico de Certificados Anteriores
  const abrirHistorico = (equip) => {
    setAtivoSelecionado(equip);
    setCarregandoHistorico(true);
    setModalHistoricoAberta(true);

    fetch(`${API_URL}/equipamentos/${equip.equipamento_id}/calibracoes`, {
      headers: { 'x-usuario-nivel': obterNivelUsuario() }
    })
      .then(res => res.json())
      .then(data => {
        setHistoricoCalibracoes(Array.isArray(data) ? data : []);
        setCarregandoHistorico(false);
      })
      .catch(err => {
        console.error('Erro ao buscar histórico:', err);
        setCarregandoHistorico(false);
      });
  };

  const handleSalvarCalibracao = (e) => {
    e.preventDefault();
    if (!arquivoPdf) {
      if (!window.confirm('Nenhum certificado/laudo em PDF foi anexado. Deseja registrar a calibração mesmo assim?')) {
        return;
      }
    }

    setSalvando(true);
    const formData = new FormData();
    formData.append('equipamento_id', ativoSelecionado.equipamento_id);
    formData.append('numero_certificado', form.numero_certificado);
    formData.append('orgao_laboratorio', form.orgao_laboratorio);
    formData.append('data_calibracao', form.data_calibracao);
    formData.append('data_validade', form.data_validade);
    formData.append('resultado_parecer', form.resultado_parecer);
    formData.append('erro_maximo_encontrado', form.erro_maximo_encontrado);
    formData.append('incerteza_medicao', form.incerteza_medicao);
    formData.append('observacoes', form.observacoes);
    formData.append('tecnico_responsavel', form.tecnico_responsavel);

    if (arquivoPdf) {
      formData.append('certificado_pdf', arquivoPdf);
    }

    fetch(`${API_URL}/calibracoes`, {
      method: 'POST',
      headers: { 'x-usuario-nivel': obterNivelUsuario() },
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        setSalvando(false);
        if (data.error) {
          alert('Erro: ' + data.error);
        } else {
          alert('Certificado de calibração registrado com sucesso! ⚖️✅');
          setModalAberta(false);
          carregarCronograma();
        }
      })
      .catch(err => {
        setSalvando(false);
        alert('Erro ao registrar calibração: ' + err.message);
      });
  };

  // Filtros
  const itensFiltrados = itens.filter(item => {
    const termo = busca.toLowerCase();
    const matchesBusca =
      (item.equipamento_nome && item.equipamento_nome.toLowerCase().includes(termo)) ||
      (item.patrimonio && item.patrimonio.toLowerCase().includes(termo)) ||
      (item.setor_nome && item.setor_nome.toLowerCase().includes(termo)) ||
      (item.certificado_calibracao_atual && item.certificado_calibracao_atual.toLowerCase().includes(termo));

    if (filtroSituacao === 'todos') return matchesBusca;
    if (filtroSituacao === 'vencidos') return matchesBusca && item.dias_restantes < 0;
    if (filtroSituacao === 'criticos') return matchesBusca && item.dias_restantes >= 0 && item.dias_restantes <= 30;
    if (filtroSituacao === 'em_dia') return matchesBusca && item.dias_restantes > 30;
    return matchesBusca;
  });

  const kpis = {
    total: itens.length,
    vencidos: itens.filter(i => i.dias_restantes !== null && i.dias_restantes < 0).length,
    criticos: itens.filter(i => i.dias_restantes !== null && i.dias_restantes >= 0 && i.dias_restantes <= 30).length,
    emDia: itens.filter(i => i.dias_restantes !== null && i.dias_restantes > 30).length,
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-50 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="bg-purple-600 p-2 rounded-xl text-white text-sm">⚖️</span> METROLOGIA & CALIBRAÇÃO
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
              Controle de ensaios, calibrações anuais e conformidade metrológica (RDC 2 / ANVISA)
            </p>
          </div>
          <button
            onClick={carregarCronograma}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 text-xs flex items-center gap-2 self-start sm:self-auto"
          >
            🔄 Atualizar
          </button>
        </div>

        {/* CARDS DE STATUS (FILTROS RÁPIDOS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <button
            onClick={() => setFiltroSituacao('todos')}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
              filtroSituacao === 'todos' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
            }`}
          >
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Total Regulado</p>
              <p className="text-lg font-black mt-0.5">{kpis.total}</p>
            </div>
            <span className="p-2 bg-white/10 rounded-xl text-xs">📋</span>
          </button>

          <button
            onClick={() => setFiltroSituacao('vencidos')}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
              filtroSituacao === 'vencidos' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50/50 text-red-700 border-red-100 hover:bg-red-100'
            }`}
          >
            <div>
              <p className={`text-[9px] font-black uppercase ${filtroSituacao === 'vencidos' ? 'text-red-200' : 'text-red-600'}`}>🚨 Calibração Vencida</p>
              <p className="text-lg font-black mt-0.5">{kpis.vencidos}</p>
            </div>
            <span className="p-2 bg-white/20 rounded-xl text-xs">⚠️</span>
          </button>

          <button
            onClick={() => setFiltroSituacao('criticos')}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
              filtroSituacao === 'criticos' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-amber-50/50 text-amber-700 border-amber-100 hover:bg-amber-100'
            }`}
          >
            <div>
              <p className={`text-[9px] font-black uppercase ${filtroSituacao === 'criticos' ? 'text-amber-100' : 'text-amber-600'}`}>⏳ Vence em até 30d</p>
              <p className="text-lg font-black mt-0.5">{kpis.criticos}</p>
            </div>
            <span className="p-2 bg-white/20 rounded-xl text-xs">⏰</span>
          </button>

          <button
            onClick={() => setFiltroSituacao('em_dia')}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
              filtroSituacao === 'em_dia' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-emerald-50/50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
            }`}
          >
            <div>
              <p className={`text-[9px] font-black uppercase ${filtroSituacao === 'em_dia' ? 'text-emerald-200' : 'text-emerald-600'}`}>🟢 Calibrações em Dia</p>
              <p className="text-lg font-black mt-0.5">{kpis.emDia}</p>
            </div>
            <span className="p-2 bg-white/20 rounded-xl text-xs">✅</span>
          </button>
        </div>

        {/* CAMPO DE BUSCA */}
        <div>
          <input
            type="text"
            placeholder="🔍 Buscar por autoclave, monitor, patrimônio, setor ou certificado..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-purple-500 transition-all text-black"
          />
        </div>
      </div>

      {/* TABELA DE CRONOGRAMA METROLÓGICO */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="p-5">Ativo / Localização</th>
                <th className="p-5">Patrimônio / Tipo</th>
                <th className="p-5">Último Certificado</th>
                <th className="p-5">Situação / Validade</th>
                <th className="p-5 text-center">Ações Metrológicas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center font-bold text-slate-400">Carregando cronograma metrológico...</td>
                </tr>
              ) : itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center font-bold text-slate-400 italic">
                    Nenhum equipamento cadastrado com exigência de calibração para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                itensFiltrados.map(item => {
                  const dias = item.dias_restantes;
                  const estaVencido = dias !== null && dias < 0;
                  const estaCritico = dias !== null && dias >= 0 && dias <= 30;

                  return (
                    <tr key={item.equipamento_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                        <div className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          {item.equipamento_nome}
                        </div>
                        <div className="text-[10px] text-purple-600 font-bold uppercase mt-0.5">
                          {item.setor_nome || 'Setor Geral'}
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="text-[11px] font-mono font-black text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded uppercase">
                          {item.patrimonio || 'S/P'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                          {item.tipo_nome || 'Equipamento Biomédico'}
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="font-mono font-bold text-slate-700">
                          {item.certificado_calibracao_atual || <span className="text-slate-400 italic">Pendente</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Última: {item.data_ultima_calibracao ? new Date(item.data_ultima_calibracao).toLocaleDateString('pt-BR') : '---'}
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider w-fit ${
                              estaVencido
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : estaCritico
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : item.data_proxima_calibracao
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.situacao_metrologica}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            Vencimento: {item.data_proxima_calibracao ? new Date(item.data_proxima_calibracao).toLocaleDateString('pt-BR') : 'A definir'}
                          </span>
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => abrirModalBaixa(item)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl font-bold text-[11px] shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                            title="Lançar novo laudo / renovar calibração"
                          >
                            <span>📝</span> Lançar Laudo
                          </button>

                          <button
                            onClick={() => abrirHistorico(item)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all"
                            title="Ver histórico e PDFs anteriores"
                          >
                            <span>📂</span> Laudos
                          </button>

                          <Link
                            to={`/prontuario/${item.equipamento_id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-xs"
                            title="Prontuário Geral"
                          >
                            📋
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: LANÇAR LAUDO DE CALIBRAÇÃO / VALIDAÇÃO */}
      {modalAberta && ativoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 my-6">
            <div className="p-5 bg-purple-700 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>⚖️ Lançar Certificado de Calibração</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110">✕</button>
            </div>

            <form onSubmit={handleSalvarCalibracao} className="p-6 space-y-4">
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 flex justify-between items-center text-xs">
                <div>
                  <span className="font-black text-purple-900 block">{ativoSelecionado.equipamento_nome}</span>
                  <span className="text-[10px] text-purple-700 font-mono">PAT: {ativoSelecionado.patrimonio || 'S/P'}</span>
                </div>
                <span className="text-[10px] font-bold text-purple-800 bg-white px-2.5 py-1 rounded-xl">
                  Ciclo: {ativoSelecionado.periodicidade_calibracao_meses || 12} meses
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Nº do Certificado / Laudo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CAL-2026-9902"
                    value={form.numero_certificado}
                    onChange={e => setForm({ ...form, numero_certificado: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-mono font-bold outline-none focus:border-purple-500 bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Órgão / Laboratório Calibrador
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LabMetrologia RBC"
                    value={form.orgao_laboratorio}
                    onChange={e => setForm({ ...form, orgao_laboratorio: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-purple-500 bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Data da Execução *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.data_calibracao}
                    onChange={e => {
                      const dt = e.target.value;
                      let validade = '';
                      if (dt) {
                        const d = new Date(dt);
                        d.setMonth(d.getMonth() + (ativoSelecionado.periodicidade_calibracao_meses || 12));
                        validade = d.toISOString().split('T')[0];
                      }
                      setForm({ ...form, data_calibracao: dt, data_validade: validade });
                    }}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold outline-none bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Data de Validade *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.data_validade}
                    onChange={e => setForm({ ...form, data_validade: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold outline-none bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Parecer Técnico
                  </label>
                  <select
                    value={form.resultado_parecer}
                    onChange={e => setForm({ ...form, resultado_parecer: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold outline-none bg-white text-black"
                  >
                    <option value="Aprovado">🟢 Aprovado para Uso</option>
                    <option value="Aprovado com Restrição">🟡 Aprovado com Restrição</option>
                    <option value="Reprovado">🔴 Reprovado</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Responsável / Engenharia
                  </label>
                  <input
                    type="text"
                    value={form.tecnico_responsavel}
                    onChange={e => setForm({ ...form, tecnico_responsavel: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold outline-none bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Erro Máximo Encontrado (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 0.2 °C / 1.5 kPa"
                    value={form.erro_maximo_encontrado}
                    onChange={e => setForm({ ...form, erro_maximo_encontrado: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-mono outline-none bg-white text-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Incerteza de Medição (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: U = 0.05 °C (k=2)"
                    value={form.incerteza_medicao}
                    onChange={e => setForm({ ...form, incerteza_medicao: e.target.value })}
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-mono outline-none bg-white text-black"
                  />
                </div>
              </div>

              {/* UPLOAD DO PDF */}
              <div className="p-3.5 border-2 border-dashed border-purple-200 rounded-2xl bg-purple-50/30">
                <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest block mb-1">
                  📄 Anexar Laudo / Certificado (PDF ou Imagem)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setArquivoPdf(e.target.files[0])}
                  className="text-xs text-slate-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-700 file:text-white hover:file:bg-purple-800 file:cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Observações Metrológicas
                </label>
                <textarea
                  rows="2"
                  placeholder="Informações adicionais dos ensaios de validação térmica, sensores, vedações, etc."
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberta(false)}
                  className="px-5 py-2.5 text-slate-400 font-black text-xs uppercase hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {salvando ? 'Gravando...' : 'Confirmar & Atualizar Validade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO DE CERTIFICADOS DO ATIVO */}
      {modalHistoricoAberta && ativoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="p-5 bg-slate-900 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>📂 Histórico de Laudos — {ativoSelecionado.equipamento_nome}</span>
              <button onClick={() => setModalHistoricoAberta(false)} className="hover:scale-110">✕</button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {carregandoHistorico ? (
                <p className="text-center font-bold text-slate-400 text-xs py-8">Buscando certificados arquivados...</p>
              ) : historicoCalibracoes.length === 0 ? (
                <p className="text-center text-slate-400 font-bold text-xs py-8 italic">
                  Nenhum laudo arquivado ainda para este equipamento.
                </p>
              ) : (
                <div className="space-y-3">
                  {historicoCalibracoes.map(c => (
                    <div key={c.id} className="p-4 border-2 border-slate-100 rounded-2xl hover:border-purple-200 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-purple-700">Certificado: {c.numero_certificado}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            c.resultado_parecer === 'Aprovado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {c.resultado_parecer}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Emitido por: <strong>{c.laboratorio_nome}</strong> | Responsável: {c.tecnico_responsavel}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Realizado em: <strong>{new Date(c.data_calibracao).toLocaleDateString('pt-BR')}</strong> | Validade até: <strong>{new Date(c.data_validade).toLocaleDateString('pt-BR')}</strong>
                        </p>
                      </div>

                      {c.url_certificado_pdf ? (
                        <a
                          href={`${BASE_URL}${c.url_certificado_pdf}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-colors self-start sm:self-auto flex items-center gap-1 border border-purple-100"
                        >
                          <span>📄</span> Abrir Laudo
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sem PDF</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setModalHistoricoAberta(false)}
                className="px-5 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrologia;