import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const Equipamentos = () => {
  const [equipamentos, setEquipamentos] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberta, setModalAberta] = useState(false)
  const [manterAberta, setManterAberta] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  
  // Controle do QR Code e Impressão de Etiquetas
  const [qrZoomUrl, setQrZoomUrl] = useState(null)
  const [ativoSelecionadoQR, setAtivoSelecionadoQR] = useState(null)

  // Armazena temporariamente o arquivo binário da foto selecionada
  const [fotoEquipamento, setFotoEquipamento] = useState(null)

  const [setores, setSetores] = useState([])
  const [tipos, setTipos] = useState([])
  const [locaisEstoque, setLocaisEstoque] = useState([])

  // Filtros dinâmicos da barra superior
  const [filtroSetor, setFiltroSetor] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos') // 🆕 Filtro por categoria/tipo

  const estadoInicial = {
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', local_estoque_id: '', valor: '', data_ultima_preventiva: '', periodicidade_preventiva: 0, status: 'Ativo'
  }
  const [form, setForm] = useState(estadoInicial)

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const gerarLinkQRCodeLocal = (id) => {
    const urlDestino = `${window.location.origin}/prontuario/${id}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlDestino)}`
  }

  const carregarDados = () => {
    fetch(`${API_URL}/equipamentos`, {
      headers: { "x-usuario-nivel": obterNivelUsuario() }
    })
    .then(res => res.json())
    .then(data => setEquipamentos(data || []))
  }

  useEffect(() => {
    carregarDados()
    
    const headersComNivel = { "x-usuario-nivel": obterNivelUsuario() };
    
    fetch(`${API_URL}/setores`, { headers: headersComNivel }).then(res => res.json()).then(data => setSetores(data || []))
    fetch(`${API_URL}/types_equipamentos`, { headers: headersComNivel }).then(res => res.json()).then(data => setTipos(data || []))
    fetch(`${API_URL}/locais-estoque`, { headers: headersComNivel }).then(res => res.json()).then(data => setLocaisEstoque(data || []))
  }, [])

  const prepararEdicao = (e) => {
    setEditandoId(e.id)
    setForm({
      ...e,
      data_ultima_preventiva: e.data_ultima_preventiva ? e.data_ultima_preventiva.split('T')[0] : '',
      periodicidade_preventiva: e.periodicidade_preventiva || 0,
      tipo_id: e.tipo_id || '',
      local_estoque_id: e.local_estoque_id || '',
      valor: e.valor !== undefined && e.valor !== null ? e.valor : ''
    })
    setFotoEquipamento(null)
    setModalAberta(true)
  }

  const excluir = (id) => {
    if (window.confirm("🚨 Tem certeza que deseja excluir este equipamento? Esta ação é permanente.")) {
      fetch(`${API_URL}/equipamentos/${id}`, { 
        method: 'DELETE',
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      }).then(() => carregarDados())
    }
  }

  const salvar = (e) => {
    e.preventDefault()
    const url = editandoId ? `${API_URL}/equipamentos/${editandoId}` : `${API_URL}/equipamentos`

    const formData = new FormData()
    formData.append('nome', form.nome || '')
    formData.append('modelo', form.modelo || '')
    formData.append('patrimonio', form.patrimonio ? form.patrimonio.trim() : '');
    formData.append('num_serie', form.num_serie || '')
    formData.append('fabricante', form.fabricante || '')
    formData.append('setor_id', form.setor_id || '')
    formData.append('status', form.status || 'Ativo')
    formData.append('tipo_id', form.tipo_id || '')
    formData.append('data_ultima_preventiva', form.data_ultima_preventiva || '')
    formData.append('periodicidade_preventiva', form.periodicidade_preventiva || 0)
    formData.append('local_estoque_id', form.local_estoque_id || '')
    formData.append('valor', form.valor || 0)
    
    if (fotoEquipamento) {
      formData.append('foto_equipamento', fotoEquipamento)
    }

    fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: {
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: formData 
    })
    .then(() => {
      carregarDados()
      setFotoEquipamento(null)
      if (!manterAberta || editandoId) {
        setModalAberta(false)
        setEditandoId(null)
        setForm(estadoInicial)
      } else {
        setForm({ ...estadoInicial, setor_id: form.setor_id, tipo_id: form.tipo_id, local_estoque_id: form.local_estoque_id })
      }
    })
    .catch(err => console.error("Erro ao salvar equipamento:", err))
  }

  // FILTRAGEM MULTI-CAMPO EM TEMPO REAL
  const equipamentosFiltrados = (equipamentos || []).filter(e => {
    if (!e) return false;
    const termo = busca.toLowerCase();
    const matchesBusca = 
      (e.nome && e.nome.toLowerCase().includes(termo)) ||
      (e.patrimonio && e.patrimonio.toLowerCase().includes(termo)) ||
      (e.num_serie && e.num_serie.toLowerCase().includes(termo)) ||
      (e.fabricante && e.fabricante.toLowerCase().includes(termo));

    const matchesSetor = filtroSetor === 'todos' || String(e.setor_id) === String(filtroSetor);
    const matchesStatus = filtroStatus === 'todos' || e.status === filtroStatus;
    const matchesTipo = filtroTipo === 'todos' || String(e.tipo_id || e.tipo_equipamento_id) === String(filtroTipo);

    return matchesBusca && matchesSetor && matchesStatus && matchesTipo;
  });

  // 🆕 MÉTRICAS/KPIs RÁPIDOS
  const kpis = {
    total: equipamentosFiltrados.length,
    ativos: equipamentosFiltrados.filter(e => e.status === 'Ativo').length,
    reserva: equipamentosFiltrados.filter(e => e.status === 'Reserva').length,
    manutencao: equipamentosFiltrados.filter(e => e.status === 'Em Manutenção').length,
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #bloco-etiqueta-impressao, #bloco-etiqueta-impressao * { visibility: visible; }
          #bloco-etiqueta-impressao { 
            position: absolute; left: 0; top: 0; width: 60mm; height: auto; padding: 5px;
            display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
          }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      {/* HEADER E BARRA DE FILTROS */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-50 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
               <span className="bg-blue-500 p-2 rounded-xl text-white text-sm">🛠️</span> GESTÃO DE ATIVOS
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Inventário patrimonial, controle operacional e prontuários</p>
          </div>
          <button
            onClick={() => { setEditandoId(null); setForm(estadoInicial); setFotoEquipamento(null); setModalAberta(true); }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            + Novo Ativo
          </button>
        </div>

        {/* 🆕 CARDS DE METRICAS (KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Filtrado</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{kpis.total}</p>
            </div>
            <span className="p-2 bg-slate-200 rounded-xl text-xs">📦</span>
          </div>

          <div className="bg-green-50/50 p-3.5 rounded-2xl border border-green-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-green-600 uppercase tracking-wider">🟢 Em Operação</p>
              <p className="text-lg font-black text-green-700 mt-0.5">{kpis.ativos}</p>
            </div>
            <span className="p-2 bg-green-100 text-green-600 rounded-xl text-xs">✅</span>
          </div>

          <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">🔵 Em Reserva</p>
              <p className="text-lg font-black text-blue-700 mt-0.5">{kpis.reserva}</p>
            </div>
            <span className="p-2 bg-blue-100 text-blue-600 rounded-xl text-xs">🔄</span>
          </div>

          <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider">🟡 Em Manutenção</p>
              <p className="text-lg font-black text-amber-700 mt-0.5">{kpis.manutencao}</p>
            </div>
            <span className="p-2 bg-amber-100 text-amber-600 rounded-xl text-xs">🛠️</span>
          </div>
        </div>

        {/* FILTROS DE PESQUISA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Busca Global</label>
            <input
              type="text"
              placeholder="🔍 Nome, patrimônio, série..."
              className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all text-xs font-bold bg-slate-50"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Isolar Localização</label>
            <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs" value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)}>
              <option value="todos">⭐ Todos os Setores</option>
              {(setores || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Filtrar Categoria</label>
            <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="todos">⭐ Todas as Categorias</option>
              {(tipos || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Filtrar Status</label>
            <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">⭐ Todos os Status</option>
              <option value="Ativo">🟢 Ativo</option>
              <option value="Reserva">🔵 Reserva</option>
              <option value="Em Manutenção">🟡 Em Manutenção</option>
              <option value="Baixado/Quebrado">🔴 Baixado / Quebrado</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="p-5">Equipamento / Setor</th>
              <th className="p-5">Patrimônio / Série</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-center">Identificador QR</th>
              <th className="p-5 text-center">Ações Operacionais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {equipamentosFiltrados.map(e => (
              <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group group text-dark">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    {/* 🆕 MINIATURA DA FOTO DO ATIVO (SE HOUVER) */}
                    {e.foto_equipamento ? (
                      <img src={`http://192.168.5.101:3000${e.foto_equipamento}`} alt="Ativo" className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs border border-slate-200">
                        {e.nome ? e.nome.substring(0,2).toUpperCase() : 'EQ'}
                      </div>
                    )}
                    <div>
                      <div className="font-black text-slate-700 uppercase tracking-tight">{e.nome}</div>
                      <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wide mt-0.5">{e.setor_nome || 'Setor não definido'}</div>
                    </div>
                  </div>
                </td>
                <td className="p-5">
                  <div className="text-[11px] font-mono font-black text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded uppercase">{e.patrimonio || 'S/P'}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Série: {e.num_serie || '---'}</div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                    e.status === 'Ativo' ? 'bg-green-50 text-green-600 border border-green-100' :
                    e.status === 'Reserva' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                    e.status === 'Baixado/Quebrado' ? 'bg-red-50 text-red-600 border border-red-100' : 
                    'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="p-5 text-center">
                  <button 
                    onClick={() => { setQrZoomUrl(gerarLinkQRCodeLocal(e.id)); setAtivoSelecionadoQR(e); }}
                    className="inline-block p-1 bg-slate-50 border border-slate-100 rounded-xl hover:scale-105 transition-all shadow-sm"
                  >
                    <img src={gerarLinkQRCodeLocal(e.id)} alt="QR" className="w-8 h-8 rounded-lg" />
                  </button>
                </td>
                <td className="p-5">
                  <div className="flex justify-center gap-2">
                    <Link to={`/prontuario/${e.id}`} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all border border-blue-100" title="Ver Prontuário">📋</Link>
                    <button onClick={() => prepararEdicao(e)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-100" title="Editar">✏️</button>
                    <button onClick={() => excluir(e.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100" title="Excluir">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {equipamentosFiltrados.length === 0 && (
              <tr>
                <td colSpan="5" className="p-10 text-center text-xs font-bold text-slate-400 italic">Nenhum equipamento localizado para os parâmetros informados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className={`p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? '✏️ Editar Equipamento' : '🆕 Novo Equipamento'}</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 grid grid-cols-2 gap-4 text-dark">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Equipamento</label>
                <input type="text" required value={form.nome} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 text-xs font-bold bg-white text-black" onChange={e => setForm({...form, nome: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Modelo</label>
                <input type="text" value={form.modelo || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black" onChange={e => setForm({...form, modelo: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fabricante</label>
                <input type="text" value={form.fabricante || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black" onChange={e => setForm({...form, fabricante: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Patrimônio</label>
                <input type="text" value={form.patrimonio || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-mono font-bold outline-none bg-white text-black" onChange={e => setForm({...form, patrimonio: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Série</label>
                <input type="text" value={form.num_serie || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black" onChange={e => setForm({...form, num_serie: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Setor Responsável</label>
                <select value={form.setor_id || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white font-bold text-xs outline-none text-black" onChange={e => setForm({...form, setor_id: e.target.value})}>
                  <option value="">Selecione o Setor...</option>
                  {(setores || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo / Família do Equipamento</label>
                <select value={form.tipo_id || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white font-bold text-xs outline-none text-black" onChange={e => setForm({...form, tipo_id: e.target.value})}>
                  <option value="">Selecione o Tipo...</option>
                  {(tipos || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Escopo / Gestão de Estoque *</label>
                <select required value={form.local_estoque_id || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white font-bold text-xs outline-none text-black" onChange={e => setForm({...form, local_estoque_id: e.target.value})}>
                  <option value="">Selecione o Escopo...</option>
                  {(locaisEstoque || []).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Operacional</label>
                <select value={form.status || 'Ativo'} className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white font-bold text-xs outline-none text-black" onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="Ativo">🟢 Ativo</option>
                  <option value="Reserva">🔵 Reserva</option>
                  <option value="Em Manutenção">🟡 Em Manutenção</option>
                  <option value="Baixado/Quebrado">🔴 Baixado/Quebrado</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor de Aquisição (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  placeholder="0.00"
                  value={form.valor || ''} 
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black font-bold" 
                  onChange={e => setForm({...form, valor: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Periodicidade Preventiva (Dias)</label>
                <input type="number" min="0" value={form.periodicidade_preventiva || 0} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black font-bold" onChange={e => setForm({...form, periodicidade_preventiva: parseInt(e.target.value) || 0})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data da Última Preventiva</label>
                <input type="date" value={form.data_ultima_preventiva || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs outline-none bg-white text-black font-bold" onChange={e => setForm({...form, data_ultima_preventiva: e.target.value})} />
              </div>

              <div className="col-span-2 bg-slate-50 p-4 border-2 border-dashed border-slate-200 rounded-2xl">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Foto do Ativo (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-800 file:text-white hover:file:bg-slate-900 file:cursor-pointer"
                  onChange={(e) => setFotoEquipamento(e.target.files[0])} 
                />
              </div>

              <div className="col-span-2 flex justify-between items-center border-t border-slate-50 pt-6 mt-2">
                {!editandoId ? (
                  <label className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded border-2 border-slate-200 text-blue-600" checked={manterAberta} onChange={e => setManterAberta(e.target.checked)} />
                    Manter janela aberta após salvar
                  </label>
                ) : <div />}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setModalAberta(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                  <button type="submit" className={`px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${editandoId ? 'bg-amber-500 shadow-amber-100' : 'bg-blue-600 shadow-blue-100'}`}>{editandoId ? 'Atualizar Dados' : 'Salvar no Inventário'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EXPANSÃO E IMPRESSÃO DO QR CODE */}
      {qrZoomUrl && ativoSelecionadoQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center">
              <span>🔍 Identificador QR</span>
              <button onClick={() => { setQrZoomUrl(null); setAtivoSelecionadoQR(null); }} className="font-bold hover:text-red-200">✕</button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center bg-white" id="bloco-etiqueta-impressao">
              <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">SEC-H ENGENHARIA CLÍNICA</span>
              <img src={qrZoomUrl} alt="QR Code" className="w-40 h-40 rounded-xl p-1 bg-white border border-slate-100" />
              <p className="mt-2 text-xs font-black text-slate-800 uppercase tracking-tight max-w-full truncate">{ativoSelecionadoQR.nome}</p>
              <p className="text-[10px] font-mono font-black text-blue-600 mt-0.5">PAT: {ativoSelecionadoQR.patrimonio || 'S/P'}</p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button type="button" onClick={() => window.print()} className="w-full py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 text-center">🖨️ Imprimir Etiqueta</button>
              <button type="button" onClick={() => { setQrZoomUrl(null); setAtivoSelecionadoQR(null); }} className="w-full py-2 bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors text-center">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipamentos;