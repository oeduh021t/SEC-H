import { useState, useEffect } from 'react';

export default function NotasFiscais() {
  // --- ESTADOS DO MÓDULO ---
  const [notas, setNotas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [estoqueItens, setEstoqueItens] = useState([]);
  const [locaisEstoque, setLocaisEstoque] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔍 ESTADOS DE FILTRO
  const [buscaInteligente, setBuscaInteligente] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Modais de Controle
  const [modalNotaAberto, setModalNotaAberto] = useState(false);
  const [modalBoletosAberto, setModalBoletosAberto] = useState(false);
  const [modalItensAberto, setModalItensAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [boletosNota, setBoletosNota] = useState([]);
  const [itensNota, setItensNota] = useState([]);

  // Estados dos Formulários
  const [novaNota, setNovaNota] = useState({
    numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '',
    data_emissao: '', data_recebimento: '', valor_total: '', descricao: ''
  });
  const [arquivosNota, setArquivosNota] = useState({ xml: null, danfe: null });

  // Estado de itens temporários para lançamento
  const [itensNovosNota, setItensNovosNota] = useState([]);
  const [isNovoCadastroItem, setIsNovoCadastroItem] = useState(false);
  const [itemTemp, setItemTemp] = useState({ 
    item_id: '', nome: '', referencia: '', local_estoque_id: '', quantidade: '', valor_unitario: '' 
  });

  const [novoBoleto, setNovoBoleto] = useState({
    parcela: '1/1', codigo_barras: '', linha_digitavel: '', valor_boleto: '', data_vencimento: ''
  });
  const [arquivoBoleto, setArquivoBoleto] = useState(null);
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().split('T')[0]);
  const [comprovanteBoleto, setComprovanteBoleto] = useState(null);

  const [novoItemNota, setNovoItemNota] = useState({ item_id: '', quantidade: '', valor_unitario: '' });
  const [salvandoItem, setSalvandoItem] = useState(false);

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  // --- BUSCA DE DADOS ---
  const carregarDados = async () => {
    setLoading(true);
    try {
      const opcoesFetch = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        }
      };

      const [resNotas, resFornecedores, resEstoque, resLocais] = await Promise.all([
        fetch(`${API_URL}/notas-fiscais`, opcoesFetch),
        fetch(`${API_URL}/fornecedores`, opcoesFetch),
        fetch(`${API_URL}/estoque`, opcoesFetch),
        fetch(`${API_URL}/locais-estoque`, opcoesFetch)
      ]);
      
      const dataNotas = await resNotas.json();
      const dataFornecedores = await resFornecedores.json();
      const dataEstoque = await resEstoque.json();
      const dataLocais = await resLocais.json();
      
      setNotas(Array.isArray(dataNotas) ? dataNotas : []);
      setFornecedores(Array.isArray(dataFornecedores) ? dataFornecedores : []);
      setEstoqueItens(Array.isArray(dataEstoque) ? dataEstoque : []);
      setLocaisEstoque(Array.isArray(dataLocais) ? dataLocais : []);
    } catch (err) {
      console.error('Erro ao conectar com a API do SEC-H:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const verBoletos = async (nota) => {
    setNotaSelecionada(nota);
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${nota.id}/boletos`, {
        method: 'GET',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      const data = await res.json();
      setBoletosNota(data);
      setModalBoletosAberto(true);
    } catch (err) {
      alert('Erro ao buscar boletos associados.');
    }
  };

  const verItensNota = async (nota) => {
    setNotaSelecionada(nota);
    setNovoItemNota({ item_id: '', quantidade: '', valor_unitario: '' });
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${nota.id}/itens`, {
        method: 'GET',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      const data = await res.json();
      setItensNota(Array.isArray(data) ? data : []);
      setModalItensAberto(true);
    } catch (err) {
      alert('Erro ao buscar itens da Nota Fiscal.');
    }
  };

  const handleAdicionarItemTemp = () => {
    if (!itemTemp.quantidade || Number(itemTemp.quantidade) <= 0) {
      alert("Informe uma quantidade válida maior que zero.");
      return;
    }

    let itemFormatado = {};

    if (isNovoCadastroItem) {
      if (!itemTemp.nome.trim()) {
        alert("Digite o nome do novo insumo para cadastrar.");
        return;
      }
      itemFormatado = {
        item_id: null,
        nome: itemTemp.nome.trim(),
        referencia: itemTemp.referencia.trim() || '',
        local_estoque_id: itemTemp.local_estoque_id || null,
        quantidade: Number(itemTemp.quantidade),
        valor_unitario: Number(itemTemp.valor_unitario || 0),
        isNovo: true
      };
    } else {
      if (!itemTemp.item_id) {
        alert("Selecione um insumo da lista ou escolha cadastrar um novo.");
        return;
      }
      const insumoSel = estoqueItens.find(i => String(i.id) === String(itemTemp.item_id));
      itemFormatado = {
        item_id: itemTemp.item_id,
        nome: insumoSel?.nome || 'Insumo',
        referencia: insumoSel?.referencia || '',
        quantidade: Number(itemTemp.quantidade),
        valor_unitario: Number(itemTemp.valor_unitario || insumoSel?.valor_unitario || 0),
        isNovo: false
      };
    }

    setItensNovosNota([...itensNovosNota, itemFormatado]);
    setItemTemp({ item_id: '', nome: '', referencia: '', local_estoque_id: '', quantidade: '', valor_unitario: '' });
    setIsNovoCadastroItem(false);
  };

  const handleRemoverItemTemp = (index) => {
    setItensNovosNota(itensNovosNota.filter((_, i) => i !== index));
  };

  const handleSalvarNota = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(novaNota).forEach(key => formData.append(key, novaNota[key]));
    if (arquivosNota.xml) formData.append('xml', arquivosNota.xml);
    if (arquivosNota.danfe) formData.append('danfe', arquivosNota.danfe);

    if (itensNovosNota.length > 0) {
      formData.append('itens', JSON.stringify(itensNovosNota));
    }

    try {
      const res = await fetch(`${API_URL}/notas-fiscais`, {
        method: 'POST',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Nota Fiscal e estoque salvos com sucesso! 📦🧾');
        setModalNotaAberto(false);
        setNovaNota({ numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '', data_emissao: '', data_recebimento: '', valor_total: '', descricao: '' });
        setArquivosNota({ xml: null, danfe: null });
        setItensNovosNota([]);
        carregarDados();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor.');
    }
  };

  const handleAnexarBoleto = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nota_fiscal_id', notaSelecionada.id);
    Object.keys(novoBoleto).forEach(key => formData.append(key, novoBoleto[key]));
    if (arquivoBoleto) formData.append('boleto_pdf', arquivoBoleto);

    try {
      const res = await fetch(`${API_URL}/boletos`, {
        method: 'POST',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Boleto anexado!');
        setNovoBoleto({ parcela: '1/1', codigo_barras: '', linha_digitavel: '', valor_boleto: '', data_vencimento: '' });
        setArquivoBoleto(null);
        verBoletos(notaSelecionada);
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao anexar boleto.');
    }
  };

  const handleBaixarBoleto = async (boletoId) => {
    const formData = new FormData();
    formData.append('data_pagamento', dataBaixa);
    if (comprovanteBoleto) formData.append('comprovante_pdf', comprovanteBoleto);

    try {
      const res = await fetch(`${API_URL}/boletos/${boletoId}/pagar`, {
        method: 'PATCH',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Boleto pago com sucesso!');
        setComprovanteBoleto(null);
        verBoletos(notaSelecionada);
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao dar baixa no pagamento.');
    }
  };

  const handleLancarItemEstoqueAvulso = async (e) => {
    e.preventDefault();
    if (!novoItemNota.item_id || !novoItemNota.quantidade) {
      alert("Selecione o insumo e informe a quantidade.");
      return;
    }

    setSalvandoItem(true);
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${notaSelecionada.id}/itens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        },
        body: JSON.stringify(novoItemNota)
      });

      const data = await res.json();
      if (res.ok) {
        alert("Item lançado no estoque!");
        setNovoItemNota({ item_id: '', quantidade: '', valor_unitario: '' });
        verItensNota(notaSelecionada);
        carregarDados();
      } else {
        alert(`Erro: ${data.error || 'Falha ao lançar item.'}`);
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setSalvandoItem(false);
    }
  };

  const handleExcluirNota = async (id) => {
    if (!window.confirm('🚨 Tem certeza? Isso apagará a nota e todos os seus boletos associados permanentemente.')) return;
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${id}`, { 
        method: 'DELETE',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      if (res.ok) {
        alert('Removido com sucesso!');
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao excluir nota.');
    }
  };

  // 🔍 LÓGICA DE FILTRAGEM MULTI-CRITÉRIOS (BUSCA INTELIGENTE + DATAS + FORNECEDOR + STATUS)
  const notasFiltradas = notas.filter(nota => {
    // 1. Busca global (Número da NF, Fornecedor ou Chave de Acesso)
    const termo = buscaInteligente.toLowerCase().trim();
    const matchBusca = !termo || 
      nota.numero_nf?.toLowerCase().includes(termo) ||
      nota.fornecedor_nome?.toLowerCase().includes(termo) ||
      nota.chave_acesso?.toLowerCase().includes(termo);

    // 2. Filtro por Fornecedor
    const matchFornecedor = !fornecedorFiltro || String(nota.fornecedor_id) === String(fornecedorFiltro);

    // 3. Filtro por Intervalo de Data de Emissão
    let matchData = true;
    if (dataInicio && dataFim) {
      const dataEmissao = new Date(nota.data_emissao).toISOString().split('T')[0];
      matchData = dataEmissao >= dataInicio && dataEmissao <= dataFim;
    }

    // 4. Filtro por Status Financeiro dos Boletos
    let matchStatus = true;
    if (statusFiltro === 'atrasados') matchStatus = Number(nota.boletos_atrasados) > 0;
    if (statusFiltro === 'vencendo') matchStatus = Number(nota.boletos_vencendo_breve) > 0;
    if (statusFiltro === 'sem_boletos') matchStatus = Number(nota.total_boletos) === 0;

    return matchBusca && matchFornecedor && matchData && matchStatus;
  });

  // 🧮 SOMATÓRIO DINÂMICO DO VALOR DAS NOTAS EXIBIDAS
  const valorTotalFiltrado = notasFiltradas.reduce((acc, n) => acc + Number(n.valor_total || 0), 0);

  const totalAtrasados = notas.reduce((acc, n) => acc + Number(n.boletos_atrasados || 0), 0);
  const totalBreve = notas.reduce((acc, n) => acc + Number(n.boletos_vencendo_breve || 0), 0);

  const renderizarBadgeAlerta = (nota) => {
    if (Number(nota.total_boletos) === 0) {
      return <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase">Sem Boletos</span>;
    }
    if (Number(nota.boletos_atrasados) > 0) {
      return (
        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 animate-pulse border border-red-200">
          🚨 {nota.boletos_atrasados} Atrasado(s)
        </span>
      );
    }
    if (Number(nota.boletos_vencendo_breve) > 0) {
      return (
        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border border-amber-200">
          ⏰ Vencendo Breve
        </span>
      );
    }
    if (nota.proximo_vencimento) {
      return (
        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase border border-blue-100">
          🗓️ Próx: {new Date(nota.proximo_vencimento).toLocaleDateString('pt-BR')}
        </span>
      );
    }
    return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase">✓ Quitado</span>;
  };

  return (
    <div className="p-4 font-sans text-slate-800">
      
      {/* HEADER DA TELA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">🧾</span> GESTÃO DE NOTAS E BOLETOS
        </h1>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          
          {/* 🔍 BUSCA GLOBAL INTELIGENTE */}
          <input
            type="text"
            placeholder="🔍 Buscar por nota, fornecedor ou chave..."
            className="px-4 py-2 border-2 border-slate-100 rounded-xl w-full md:w-80 outline-none focus:border-blue-500 transition-all text-sm font-medium bg-white text-black"
            value={buscaInteligente}
            onChange={e => setBuscaInteligente(e.target.value)}
          />

          <button 
            onClick={() => {
              setNovaNota({ numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '', data_emissao: '', data_recebimento: '', valor_total: '', descricao: '' });
              setArquivosNota({ xml: null, danfe: null });
              setItensNovosNota([]);
              setIsNovoCadastroItem(false);
              setModalNotaAberto(true);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-wider w-full md:w-auto"
          >
            + Lançar Nova Nota
          </button>
        </div>
      </div>

      {/* CARDS DE MONITORAMENTO DE VENCIMENTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Boletos Vencidos</span>
            <span className="text-2xl font-black text-red-600">{totalAtrasados} Pendentes</span>
          </div>
          <span className="text-3xl bg-red-50 p-2.5 rounded-2xl text-red-500">🚨</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vencem nos Próximos 5 Dias</span>
            <span className="text-2xl font-black text-amber-600">{totalBreve} Parcela(s)</span>
          </div>
          <span className="text-3xl bg-amber-50 p-2.5 rounded-2xl text-amber-500">⏳</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Notas Cadastradas</span>
            <span className="text-2xl font-black text-slate-800">{notas.length} Documentos</span>
          </div>
          <span className="text-3xl bg-blue-50 p-2.5 rounded-2xl text-blue-500">📑</span>
        </div>
      </div>

      {/* 🎛️ BARRA COMPACTA DE FILTROS AVANÇADOS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Filtro Fornecedor */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Fornecedor</label>
            <select
              className="px-3 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-white text-black outline-none focus:border-blue-500"
              value={fornecedorFiltro}
              onChange={e => setFornecedorFiltro(e.target.value)}
            >
              <option value="">Todos os Fornecedores</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status Financeiro */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Status Cobrança</label>
            <select
              className="px-3 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-white text-black outline-none focus:border-blue-500"
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="atrasados">🚨 Atrasados</option>
              <option value="vencendo">⏰ Vencendo Breve</option>
              <option value="sem_boletos">⚪ Sem Boletos</option>
            </select>
          </div>

          {/* Filtro de Datas */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Emissão De</label>
            <input
              type="date"
              className="px-2.5 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-white text-black outline-none focus:border-blue-500"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Até</label>
            <input
              type="date"
              className="px-2.5 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-white text-black outline-none focus:border-blue-500"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </div>

          {(fornecedorFiltro || statusFiltro !== 'todos' || dataInicio || dataFim || buscaInteligente) && (
            <button
              type="button"
              onClick={() => {
                setFornecedorFiltro('');
                setStatusFiltro('todos');
                setDataInicio('');
                setDataFim('');
                setBuscaInteligente('');
              }}
              className="mt-4 text-[10px] font-black text-red-500 hover:underline uppercase"
            >
              ✕ Limpar Filtros
            </button>
          )}
        </div>

        {/* Totalizador filtrado */}
        <div className="text-right">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total das Notas Filtradas</span>
          <span className="text-lg font-black text-slate-800 font-mono">
            R$ {valorTotalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Carregando dados financeiros do SEC-H...</div>
        ) : notasFiltradas.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Nenhuma nota fiscal localizada com os filtros aplicados.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 tracking-widest uppercase border-b">
              <tr>
                <th className="p-5">Número / Série</th>
                <th className="p-5">Fornecedor</th>
                <th className="p-5">Emissão</th>
                <th className="p-5">Valor Total</th>
                <th className="p-5">Status dos Boletos</th>
                <th className="p-5">Arquivos</th>
                <th className="p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notasFiltradas.map((nota) => (
                <tr key={nota.id} className="hover:bg-slate-50/50 transition-colors group text-dark">
                  <td className="p-5 font-bold text-slate-700 text-sm">
                    {nota.numero_nf} <span className="text-slate-400 font-normal text-xs">({nota.serie || 'Única'})</span>
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-600 uppercase">{nota.fornecedor_nome}</td>
                  <td className="p-5 text-xs font-mono">{new Date(nota.data_emissao).toLocaleDateString('pt-BR')}</td>
                  <td className="p-5 font-bold text-slate-700 text-sm">R$ {Number(nota.valor_total).toFixed(2)}</td>
                  <td className="p-5">
                    {renderizarBadgeAlerta(nota)}
                  </td>
                  <td className="p-5 space-x-2">
                    {nota.url_xml && <a href={`${API_URL.replace('/api', '')}${nota.url_xml}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase hover:bg-blue-600 hover:text-white transition-all">XML</a>}
                    {nota.url_danfe && <a href={`${API_URL.replace('/api', '')}${nota.url_danfe}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded uppercase hover:bg-purple-600 hover:text-white transition-all">DANFE</a>}
                  </td>
                  <td className="p-5">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => verItensNota(nota)} 
                        className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 text-xs font-black uppercase tracking-wider"
                        title="Lançar itens e dar entrada no estoque"
                      >
                        📦 Itens
                      </button>
                      <button onClick={() => verBoletos(nota)} className="px-3 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100 text-xs font-black uppercase tracking-wider">
                        📁 Boletos ({nota.total_boletos || 0})
                      </button>
                      <button onClick={() => handleExcluirNota(nota.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100" title="Remover Nota">
                        <span className="text-sm">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL 1: CADASTRAR NOTA + SELEÇÃO / CADASTRO RÁPIDO DE INSUMOS --- */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[92vh] flex flex-col">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-blue-600 shrink-0">
              <span>🆕 Novo Lançamento Fiscal & Entrada de Estoque</span>
              <button onClick={() => setModalNotaAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={handleSalvarNota} className="p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* BLOCO 1: DADOS DA NOTA FISCAL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Número da NF *</label>
                  <input type="text" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm bg-white text-black" value={novaNota.numero_nf} onChange={e => setNovaNota({...novaNota, numero_nf: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Série</label>
                  <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium bg-white text-black" value={novaNota.serie} onChange={e => setNovaNota({...novaNota, serie: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chave de Acesso (44 dígitos)</label>
                  <input type="text" maxLength={44} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-sm bg-white text-black tracking-widest" value={novaNota.chave_acesso} onChange={e => setNovaNota({...novaNota, chave_acesso: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fornecedor Vinculado *</label>
                  <select required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm text-black" value={novaNota.fornecedor_id} onChange={e => setNovaNota({...novaNota, fornecedor_id: e.target.value})}>
                    <option value="">Selecione o Fornecedor</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Emissão *</label>
                  <input type="date" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm bg-white text-black" value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Total (R$) *</label>
                  <input type="number" step="0.01" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-bold bg-white text-black" value={novaNota.valor_total} onChange={e => setNovaNota({...novaNota, valor_total: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arquivo XML da Nota</label>
                  <input type="file" accept=".xml" className="w-full text-xs font-mono p-1" onChange={e => setArquivosNota({...arquivosNota, xml: e.target.files[0]})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arquivo PDF DANFE</label>
                  <input type="file" accept=".pdf" className="w-full text-xs font-mono p-1" onChange={e => setArquivosNota({...arquivosNota, danfe: e.target.files[0]})} />
                </div>
              </div>

              {/* 📦 BLOCO 2: LANÇAMENTO / CADASTRO DE ITENS NO ESTOQUE */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>📦</span> Adicionar Itens / Dar Entrada em Estoque
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNovoCadastroItem(!isNovoCadastroItem);
                      setItemTemp({ item_id: '', nome: '', referencia: '', local_estoque_id: '', quantidade: '', valor_unitario: '' });
                    }}
                    className="text-[10px] font-black text-blue-600 hover:underline uppercase bg-blue-50 px-3 py-1 rounded-lg border border-blue-100"
                  >
                    {isNovoCadastroItem ? '← Selecionar Insumo Existente' : '➕ Cadastrar Novo Insumo'}
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  {!isNovoCadastroItem ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Insumo do Almoxarifado</label>
                        <select
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-blue-500"
                          value={itemTemp.item_id}
                          onChange={e => {
                            if (e.target.value === 'NOVO_ITEM') {
                              setIsNovoCadastroItem(true);
                              setItemTemp({ item_id: '', nome: '', referencia: '', local_estoque_id: '', quantidade: '', valor_unitario: '' });
                              return;
                            }
                            const insumoSel = estoqueItens.find(i => String(i.id) === String(e.target.value));
                            setItemTemp({
                              ...itemTemp,
                              item_id: e.target.value,
                              valor_unitario: insumoSel ? insumoSel.valor_unitario : itemTemp.valor_unitario
                            });
                          }}
                        >
                          <option value="">Selecione o Insumo...</option>
                          <option value="NOVO_ITEM" className="font-bold text-blue-600">➕ [ CADASTRAR NOVO INSUMO... ]</option>
                          {estoqueItens.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.nome} {i.referencia ? `(Ref: ${i.referencia})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ex: 10"
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-blue-500"
                          value={itemTemp.quantidade}
                          onChange={e => setItemTemp({ ...itemTemp, quantidade: e.target.value })}
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={handleAdicionarItemTemp}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-100"
                        >
                          + Incluir Item
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                        <span>✨</span> Cadastrando Novo Insumo que não existe no estoque
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nome do Novo Insumo *</label>
                          <input
                            type="text"
                            placeholder="Ex: Disjuntor Bipolar 32A Siemens..."
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-blue-500"
                            value={itemTemp.nome}
                            onChange={e => setItemTemp({ ...itemTemp, nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Código / Referência</label>
                          <input
                            type="text"
                            placeholder="Ex: REF-9908"
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-medium focus:border-blue-500"
                            value={itemTemp.referencia}
                            onChange={e => setItemTemp({ ...itemTemp, referencia: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Local de Estoque</label>
                          <select
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold"
                            value={itemTemp.local_estoque_id}
                            onChange={e => setItemTemp({ ...itemTemp, local_estoque_id: e.target.value })}
                          >
                            <option value="">Selecione o Local...</option>
                            {locaisEstoque.map(l => (
                              <option key={l.id} value={l.id}>{l.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Qtd Comprada *</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Ex: 5"
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-blue-500"
                            value={itemTemp.quantidade}
                            onChange={e => setItemTemp({ ...itemTemp, quantidade: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-blue-500"
                            value={itemTemp.valor_unitario}
                            onChange={e => setItemTemp({ ...itemTemp, valor_unitario: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleAdicionarItemTemp}
                          className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-100"
                        >
                          ✓ Adicionar Novo Insumo à Nota
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABELA DE ITENS INCLUÍDOS NO FORMULÁRIO */}
                {itensNovosNota.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase">
                        <tr>
                          <th className="p-3">Insumo</th>
                          <th className="p-3 text-center">Tipo</th>
                          <th className="p-3 text-center">Quantidade</th>
                          <th className="p-3 text-right">Valor Unit.</th>
                          <th className="p-3 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {itensNovosNota.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800">
                              {item.nome} {item.referencia && <span className="text-[10px] text-slate-400 block font-normal">Ref: {item.referencia}</span>}
                            </td>
                            <td className="p-3 text-center">
                              {item.isNovo ? (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase">✨ Novo Item</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">Existente</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-indigo-600">+{item.quantidade} un.</td>
                            <td className="p-3 text-right font-mono">R$ {Number(item.valor_unitario).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverItemTemp(idx)}
                                className="text-red-500 hover:text-red-700 font-black text-xs"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
                <button type="button" onClick={() => setModalNotaAberto(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 bg-blue-600 shadow-blue-100">
                  Salvar Nota Fiscal & Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: GESTÃO DE BOLETOS VINCULADOS --- */}
      {modalBoletosAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-slate-800">
              <span>🗓️ Cronograma de Cobranças: NF #{notaSelecionada?.numero_nf}</span>
              <button onClick={() => setModalBoletosAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleAnexarBoleto} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-4 gap-4 items-end">
                <div className="col-span-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Vincular Nova Parcela</div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Identificação/Parc</label>
                  <input type="text" className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold" value={novoBoleto.parcela} onChange={e => setNovoBoleto({...novoBoleto, parcela: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Valor da Parcela *</label>
                  <input type="number" step="0.01" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold" value={novoBoleto.valor_boleto} onChange={e => setNovoBoleto({...novoBoleto, valor_boleto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Data de Vencimento *</label>
                  <input type="date" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black" value={novoBoleto.data_vencimento} onChange={e => setNovoBoleto({...novoBoleto, data_vencimento: e.target.value})} />
                </div>
                <div>
                  <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-50">
                    + Incluir Parcela
                  </button>
                </div>
                <div className="col-span-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Documento PDF do Boleto</label>
                  <input type="file" accept=".pdf" className="text-xs font-mono" onChange={e => setArquivoBoleto(e.target.files[0])} />
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Duplicatas do Documento</h3>
                {boletosNota.length === 0 ? (
                  <p className="text-slate-400 text-xs font-bold uppercase text-center py-6 bg-slate-50/50 rounded-2xl">Nenhum boleto gerado para este faturamento.</p>
                ) : (
                  <div className="space-y-2">
                    {boletosNota.map(b => (
                      <div key={b.id} className="border border-slate-100 rounded-2xl p-4 bg-white flex justify-between items-center shadow-xs hover:border-slate-200 transition-all">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700 text-sm">Parcela {b.parcela}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${b.status_pagamento === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {b.status_pagamento}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-medium">Vencimento: <span className="font-mono text-slate-500">{new Date(b.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></div>
                          <div className="flex gap-2 pt-1">
                            {b.url_boleto_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_boleto_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline">📄 Ver Duplicata</a>}
                            {b.url_comprovante_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_comprovante_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-green-600 hover:underline">🧾 Ver Recibo/Comprovante</a>}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-black text-slate-700 text-base">R$ {Number(b.valor_boleto).toFixed(2)}</div>
                          </div>
                          {b.status_pagamento !== 'Pago' && (
                            <div className="flex flex-col items-end gap-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                              <input type="file" accept=".pdf" className="text-[9px] font-mono w-40" onChange={e => setComprovanteBoleto(e.target.files[0])} />
                              <button type="button" onClick={() => handleBaixarBoleto(b.id)} className="bg-green-600 hover:bg-green-700 text-white font-black text-[9px] px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider transition-all">
                                Quitar Parcela
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ITENS DA NOTA E ENTRADA POSTERIOR EM ESTOQUE --- */}
      {modalItensAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-indigo-600">
              <span>📦 Itens & Entrada de Estoque: NF #{notaSelecionada?.numero_nf}</span>
              <button onClick={() => setModalItensAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              
              <form onSubmit={handleLancarItemEstoqueAvulso} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="col-span-1 sm:col-span-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">
                  Lançar Item do Faturamento no Almoxarifado
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Insumo / Peça *</label>
                  <select
                    required
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-indigo-500"
                    value={novoItemNota.item_id}
                    onChange={e => {
                      const itemSel = estoqueItens.find(i => String(i.id) === String(e.target.value));
                      setNovoItemNota({
                        ...novoItemNota,
                        item_id: e.target.value,
                        valor_unitario: itemSel ? itemSel.valor_unitario : novoItemNota.valor_unitario
                      });
                    }}
                  >
                    <option value="">Selecione o Insumo do Estoque...</option>
                    {estoqueItens.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.nome} {i.referencia ? `(Ref: ${i.referencia})` : ''} - Saldo: {i.quantidade} un.
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Qtd Comprada *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ex: 10"
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-indigo-500"
                    value={novoItemNota.quantidade}
                    onChange={e => setNovoItemNota({ ...novoItemNota, quantidade: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold focus:border-indigo-500"
                    value={novoItemNota.valor_unitario}
                    onChange={e => setNovoItemNota({ ...novoItemNota, valor_unitario: e.target.value })}
                  />
                </div>

                <div className="col-span-1 sm:col-span-4 flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={salvandoItem}
                    className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50"
                  >
                    {salvandoItem ? 'Lançando...' : '+ Lançar no Estoque'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Insumos Recebidos Nesta Nota Fiscal</h3>
                {itensNota.length === 0 ? (
                  <p className="text-slate-400 text-xs font-bold uppercase text-center py-6 bg-slate-50/50 rounded-2xl">
                    Nenhum item lançado para esta nota fiscal ainda.
                  </p>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 tracking-widest uppercase border-b border-slate-100">
                        <tr>
                          <th className="p-3">Insumo / Peça</th>
                          <th className="p-3 text-center">Quantidade</th>
                          <th className="p-3 text-right">Valor Unitário</th>
                          <th className="p-3 text-right">Total Item</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {itensNota.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-bold text-slate-800">
                              {item.item_nome}
                              {item.referencia && <span className="text-[10px] text-slate-400 block font-normal">Ref: {item.referencia}</span>}
                            </td>
                            <td className="p-3 text-center font-bold text-indigo-600">
                              +{item.quantidade} un.
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                              R$ {Number(item.valor_unitario || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">
                              R$ {Number(item.valor_total_item || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}