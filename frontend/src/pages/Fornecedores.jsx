import { useEffect, useState } from 'react';

const Fornecedores = () => {
  const [fornecedores, setFornecedores] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 8;

  // Modais e Formulários
  const [modalAberta, setModalAberta] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const estadoInicial = { 
    nome_fantasia: '', 
    razao_social: '', 
    cnpj: '', 
    contato: '', 
    telefone: '', 
    email: '', 
    especialidade: '', 
    status: 'Ativo' 
  };
  const [form, setForm] = useState(estadoInicial);
  const [arquivoContrato, setArquivoContrato] = useState(null);

  const API_URL = '/api';
  const BASE_URL = '';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarFornecedores = () => {
    setLoading(true);
    fetch(`${API_URL}/fornecedores`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(data => setFornecedores(Array.isArray(data) ? data : []))
      .catch(err => console.error("Erro ao buscar fornecedores:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { 
    carregarFornecedores(); 
  }, []);

  // 📊 EXPORTAR EXCEL (.XLSX)
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/exportar/fornecedores`, {
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });

      if (!res.ok) throw new Error("Falha ao gerar arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `catalogo_fornecedores_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("Erro ao exportar Excel: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  const prepararEdicao = (f) => {
    setEditandoId(f.id);
    setForm({
      nome_fantasia: f.nome_fantasia || '',
      razao_social: f.razao_social || '',
      cnpj: f.cnpj || '',
      contato: f.contato || '',
      telefone: f.telefone || f.telephone || '', 
      email: f.email || '',
      especialidade: f.especialidade || '',
      status: f.status || 'Ativo'
    });
    setArquivoContrato(null);
    setModalAberta(true);
  };

  const excluirFornecedor = (id) => {
    if (window.confirm("🚨 Tem certeza que deseja remover este fornecedor? Esta ação é permanente.")) {
      fetch(`${API_URL}/fornecedores/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        }
      })
        .then(res => {
          if (!res.ok) alert("Você não possui permissão para excluir registros.");
          carregarFornecedores();
        })
        .catch(err => console.error("Erro ao deletar fornecedor:", err));
    }
  };

  const salvar = (e) => {
    e.preventDefault();
    const url = editandoId ? `${API_URL}/fornecedores/${editandoId}` : `${API_URL}/fornecedores`;

    const formData = new FormData();
    Object.keys(form).forEach(key => {
      formData.append(key, form[key]);
    });

    if (arquivoContrato) {
      formData.append('contrato', arquivoContrato);
    }

    fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 
        'x-usuario-nivel': obterNivelUsuario() 
      },
      body: formData
    })
    .then(res => {
      if (res.ok) {
        alert(editandoId ? "Fornecedor atualizado com sucesso! ✏️" : "Fornecedor cadastrado com sucesso! 🚚✨");
        carregarFornecedores();
        setModalAberta(false);
        setEditandoId(null);
        setForm(estadoInicial);
        setArquivoContrato(null);
      } else {
        alert("Erro ao salvar os dados do fornecedor. Verifique suas permissões de acesso.");
      }
    })
    .catch(err => console.error("Erro na requisição salvar:", err));
  };

  // Lista única de especialidades cadastradas para filtro dinâmico
  const listaEspecialidades = Array.from(new Set(fornecedores.map(f => f.especialidade).filter(Boolean)));

  // Filtragem
  const fornecedoresFiltrados = fornecedores.filter(f => {
    const termo = busca.toLowerCase().trim();
    const bateBusca = !termo || 
      f.nome_fantasia?.toLowerCase().includes(termo) ||
      f.razao_social?.toLowerCase().includes(termo) ||
      f.cnpj?.includes(termo) ||
      f.contato?.toLowerCase().includes(termo);

    const bateEspecialidade = filtroEspecialidade === 'todos' || f.especialidade === filtroEspecialidade;
    const bateStatus = filtroStatus === 'todos' || f.status === filtroStatus;

    return bateBusca && bateEspecialidade && bateStatus;
  });

  // Métricas
  const totalCadastrados = fornecedores.length;
  const totalComContrato = fornecedores.filter(f => f.contrato_url).length;
  const totalAtivos = fornecedores.filter(f => f.status === 'Ativo').length;

  // Paginação
  const totalPaginas = Math.ceil(fornecedoresFiltrados.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const fornecedoresPaginados = fornecedoresFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) return (
    <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
      Carregando catálogo de fornecedores e parceiros...
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🚚</span> GESTÃO DE FORNECEDORES
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Cadastro de parceiros técnicos, prestadores de serviço e contratos
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="🔍 Buscar nome, CNPJ ou contato..."
            className="px-4 py-2.5 border-2 border-slate-100 rounded-xl w-full sm:w-72 outline-none focus:border-blue-500 transition-all text-xs font-bold bg-slate-50 text-slate-800"
            value={busca}
            onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }}
          />

          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={exportando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            title="Exportar fornecedores para planilha"
          >
            <span>📊</span> {exportando ? "..." : "Excel"}
          </button>

          <button
            onClick={() => { setEditandoId(null); setForm(estadoInicial); setArquivoContrato(null); setModalAberta(true); }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            + Novo Fornecedor
          </button>
        </div>
      </div>

      {/* CARDS DE STATUS (KPIS INTERATIVOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          type="button"
          onClick={() => { setFiltroStatus('todos'); setFiltroEspecialidade('todos'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            filtroStatus === 'todos' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest block ${filtroStatus === 'todos' ? 'text-slate-400' : 'text-slate-400'}`}>Total de Fornecedores</span>
            <span className="text-xl font-black mt-0.5">{totalCadastrados} Cadastrados</span>
          </div>
          <span className="text-xl">🏢</span>
        </button>

        <button
          type="button"
          onClick={() => { setFiltroStatus('Ativo'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            filtroStatus === 'Ativo' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white border-slate-100 hover:bg-green-50/50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest block ${filtroStatus === 'Ativo' ? 'text-green-100' : 'text-slate-400'}`}>Fornecedores Ativos</span>
            <span className={`text-xl font-black mt-0.5 ${filtroStatus === 'Ativo' ? 'text-white' : 'text-green-600'}`}>{totalAtivos} Homologados</span>
          </div>
          <span className="text-xl">✅</span>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Contratos Anexados</span>
            <span className="text-xl font-black text-blue-600 mt-0.5">{totalComContrato} com Laudo/PDF</span>
          </div>
          <span className="text-xl">📄</span>
        </div>
      </div>

      {/* BARRA DE FILTRO POR RAMO / ESPECIALIDADE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Filtrar por Especialidade</label>
            <select
              className="px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={filtroEspecialidade}
              onChange={e => { setFiltroEspecialidade(e.target.value); setPaginaAtual(1); }}
            >
              <option value="todos">⭐ Todas as Especialidades</option>
              {listaEspecialidades.map((esp, i) => (
                <option key={i} value={esp}>{esp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Filtrar por Status</label>
            <select
              className="px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={filtroStatus}
              onChange={e => { setFiltroStatus(e.target.value); setPaginaAtual(1); }}
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">🟢 Ativo</option>
              <option value="Inativo">🔴 Inativo</option>
            </select>
          </div>

          {(filtroEspecialidade !== 'todos' || filtroStatus !== 'todos' || busca) && (
            <button
              type="button"
              onClick={() => { setFiltroEspecialidade('todos'); setFiltroStatus('todos'); setBusca(''); setPaginaAtual(1); }}
              className="mt-3 text-[10px] font-black text-red-500 hover:underline uppercase"
            >
              ✕ Limpar Filtros
            </button>
          )}
        </div>

        <span className="text-[10px] font-bold text-slate-400 uppercase">
          Exibindo <strong>{fornecedoresFiltrados.length}</strong> fornecedor(es)
        </span>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="p-5">Empresa / Status</th>
                <th className="p-5">CNPJ / Ramo</th>
                <th className="p-5">Contato & Atendimento</th>
                <th className="p-5 text-center">Ações & Contrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {fornecedoresPaginados.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                  
                  {/* NOME / RAZÃO */}
                  <td className="p-5">
                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{f.nome_fantasia}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5 truncate max-w-xs">{f.razao_social || 'Razão social não informada'}</div>
                    <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      f.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      ● {f.status || 'Ativo'}
                    </span>
                  </td>

                  {/* CNPJ / ESPECIALIDADE */}
                  <td className="p-5">
                    <div className="text-[11px] font-black text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded font-mono uppercase">
                      {f.cnpj || 'SEM CNPJ'}
                    </div>
                    <div className="text-[10px] text-blue-600 font-black mt-1 uppercase tracking-wider">
                      🏷️ {f.especialidade || 'Geral / Manutenção'}
                    </div>
                  </td>

                  {/* CONTATO & ATENDIMENTO */}
                  <td className="p-5 space-y-1">
                    <div className="text-xs font-bold text-slate-700">
                      👤 {f.contato || 'Atendimento Geral'}
                    </div>
                    
                    {f.email && (
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <a href={`mailto:${f.email}`} className="text-blue-600 hover:underline truncate max-w-xs" title={`Enviar e-mail para ${f.email}`}>
                          ✉️ {f.email}
                        </a>
                      </div>
                    )}

                    {f.telefone && (
                      <div className="text-[10px] text-slate-600 font-bold flex items-center gap-1">
                        <a 
                          href={`https://wa.me/55${f.telefone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-emerald-700 hover:underline"
                          title="Chamar no WhatsApp"
                        >
                          📞 {f.telefone}
                        </a>
                      </div>
                    )}
                  </td>

                  {/* AÇÕES E CONTRATO */}
                  <td className="p-5">
                    <div className="flex justify-center items-center gap-1.5">
                      {f.contrato_url ? (
                        <a
                          href={`${BASE_URL}${f.contrato_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 text-xs"
                          title="Visualizar Contrato PDF"
                        >
                          📄
                        </a>
                      ) : (
                        <span className="p-2 bg-slate-50 text-slate-300 rounded-xl border border-slate-100 cursor-not-allowed text-xs" title="Sem contrato anexado">
                          📄
                        </span>
                      )}

                      <button
                        onClick={() => prepararEdicao(f)}
                        className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100 text-xs"
                        title="Editar Fornecedor"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => excluirFornecedor(f.id)}
                        className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 text-xs"
                        title="Remover Fornecedor"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>

                </tr>
              ))}

              {fornecedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center p-12 text-xs font-bold text-slate-400 italic">
                    Nenhum fornecedor localizado com os critérios aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        {fornecedoresFiltrados.length > 0 && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">
              Exibindo <strong>{fornecedoresPaginados.length}</strong> de <strong>{fornecedoresFiltrados.length}</strong> fornecedores cadastrados
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs font-black text-slate-700 px-2">
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaAtual === totalPaginas}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className={`p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? '✏️ Editar Fornecedor' : '🆕 Novo Fornecedor'}</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 grid grid-cols-2 gap-4 text-slate-800">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Fantasia *</label>
                <input type="text" required value={form.nome_fantasia} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-xs bg-slate-50 text-slate-800" onChange={e => setForm({...form, nome_fantasia: e.target.value})} />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Razão Social</label>
                <input type="text" value={form.razao_social} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs font-medium bg-slate-50 text-slate-800" onChange={e => setForm({...form, razao_social: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">CNPJ</label>
                <input type="text" value={form.cnpj} placeholder="00.000.000/0001-00" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-xs bg-slate-50 text-slate-800 font-bold" onChange={e => setForm({...form, cnpj: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Especialidade / Ramo</label>
                <input type="text" value={form.especialidade} placeholder="Ex: Engenharia Clínica, Refrigeração" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs bg-slate-50 text-slate-800 font-bold" onChange={e => setForm({...form, especialidade: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Contato (Representante)</label>
                <input type="text" value={form.contato} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs bg-slate-50 text-slate-800 font-bold" onChange={e => setForm({...form, contato: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Telefone Comercial</label>
                <input type="text" value={form.telefone} placeholder="(00) 00000-0000" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs font-medium bg-slate-50 text-slate-800" onChange={e => setForm({...form, telefone: e.target.value})} />
              </div>

              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">E-mail de Suporte / Comercial</label>
                  <input type="email" value={form.email} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs font-mono bg-slate-50 text-slate-800" onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Cadastral</label>
                  <select value={form.status} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs text-slate-800" onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="Ativo">🟢 Ativo</option>
                    <option value="Inativo">🔴 Inativo</option>
                  </select>
                </div>
              </div>

              {/* UPLOAD DE CONTRATO EM PDF */}
              <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 mt-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Anexar Contrato (PDF / Imagem)</label>
                <input 
                  type="file" 
                  accept="application/pdf,image/*" 
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-800 file:text-white hover:file:bg-slate-900 file:cursor-pointer" 
                  onChange={e => setArquivoContrato(e.target.files[0])} 
                />
              </div>

              {/* RODAPÉ DO FORMULÁRIO */}
              <div className="col-span-2 flex justify-end gap-3 border-t border-slate-50 pt-6 mt-4">
                <button type="button" onClick={() => setModalAberta(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className={`px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${editandoId ? 'bg-amber-500 shadow-amber-100' : 'bg-blue-600 shadow-blue-100'}`}>
                  {editandoId ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fornecedores;