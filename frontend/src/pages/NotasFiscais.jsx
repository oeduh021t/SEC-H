import { useState, useEffect } from 'react';

export default function NotasFiscais() {
  const [notas, setNotas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [estoqueItens, setEstoqueItens] = useState([]);
  const [locaisEstoque, setLocaisEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Filtros
  const [buscaInteligente, setBuscaInteligente] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;
  
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

  const API_URL = '/api';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

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
      console.error('Erro ao carregar dados fiscais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ⚡ LEITOR AUTOMÁTICO DE XML (PARSER SEFAZ / NFE)
  const handleImportarXML = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setArquivosNota(prev => ({ ...prev, xml: file }));

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // 1. Dados Básicos da NF-e
        const nNF = xmlDoc.querySelector("nNF")?.textContent || '';
        const serie = xmlDoc.querySelector("serie")?.textContent || '';
        const dhEmi = xmlDoc.querySelector("dhEmi")?.textContent || xmlDoc.querySelector("dEmi")?.textContent || '';
        const dataFormatada = dhEmi ? dhEmi.split('T')[0] : '';
        const vNF = xmlDoc.querySelector("vNF")?.textContent || '';
        
        // Chave de Acesso (ID da infNFe)
        const infNFe = xmlDoc.querySelector("infNFe");
        let chaveAcesso = '';
        if (infNFe && infNFe.getAttribute("Id")) {
          chaveAcesso = infNFe.getAttribute("Id").replace(/\D/g, '');
        }

        // 2. Dados do Fornecedor (Emitente)
        const emitCNPJ = xmlDoc.querySelector("emit > CNPJ")?.textContent || '';
        const emitNome = xmlDoc.querySelector("emit > xNome")?.textContent || '';

        // Tenta cruzar com fornecedor já existente na base
        let idFornecedorEncontrado = '';
        if (emitCNPJ) {
          const fEncontrado = fornecedores.find(f => f.cnpj && f.cnpj.replace(/\D/g, '') === emitCNPJ.replace(/\D/g, ''));
          if (fEncontrado) idFornecedorEncontrado = fEncontrado.id;
        }
        if (!idFornecedorEncontrado && emitNome) {
          const fEncontrado = fornecedores.find(f => f.nome_fantasia?.toLowerCase().includes(emitNome.toLowerCase().trim()) || f.razao_social?.toLowerCase().includes(emitNome.toLowerCase().trim()));
          if (fEncontrado) idFornecedorEncontrado = fEncontrado.id;
        }

        // Preenche o formulário da Nota
        setNovaNota(prev => ({
          ...prev,
          numero_nf: nNF,
          serie: serie,
          chave_acesso: chaveAcesso,
          data_emissao: dataFormatada,
          valor_total: vNF,
          fornecedor_id: idFornecedorEncontrado ? String(idFornecedorEncontrado) : prev.fornecedor_id,
          descricao: `Importada via XML [Emitente: ${emitNome} - CNPJ: ${emitCNPJ}]`
        }));

        // 3. Extração dos Itens / Produtos da NF
        const detList = xmlDoc.querySelectorAll("det");
        const itensLidos = [];

        detList.forEach(det => {
          const xProd = det.querySelector("prod > xProd")?.textContent || 'Produto';
          const cProd = det.querySelector("prod > cProd")?.textContent || '';
          const qCom = Number(det.querySelector("prod > qCom")?.textContent || 0);
          const vUnCom = Number(det.querySelector("prod > vUnCom")?.textContent || 0);

          if (qCom > 0) {
            // Tenta casar com algum item já cadastrado no estoque por nome ou referência
            const itemEstoqueCasado = estoqueItens.find(ei => 
              (ei.referencia && cProd && ei.referencia.trim() === cProd.trim()) ||
              (ei.nome && ei.nome.toLowerCase().trim() === xProd.toLowerCase().trim())
            );

            if (itemEstoqueCasado) {
              itensLidos.push({
                item_id: itemEstoqueCasado.id,
                nome: itemEstoqueCasado.nome,
                referencia: itemEstoqueCasado.referencia || cProd,
                local_estoque_id: itemEstoqueCasado.local_estoque_id || null,
                quantidade: qCom,
                valor_unitario: vUnCom || itemEstoqueCasado.valor_unitario,
                isNovo: false
              });
            } else {
              itensLidos.push({
                item_id: null,
                nome: xProd,
                referencia: cProd,
                local_estoque_id: null,
                quantidade: qCom,
                valor_unitario: vUnCom,
                isNovo: true
              });
            }
          }
        });

        if (itensLidos.length > 0) {
          setItensNovosNota(itensLidos);
        }

        alert(`✅ XML lido com sucesso!\n• NF nº: ${nNF}\n• Emitente: ${emitNome}\n• Total de Itens Carregados: ${itensLidos.length}`);
      } catch (err) {
        console.error("Erro ao processar XML:", err);
        alert("❌ Erro ao ler a estrutura do arquivo XML.");
      }
    };
    reader.readAsText(file);
  };

  // 📊 EXPORTAR EXCEL (.XLSX)
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/exportar/notas-fiscais`, {
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });

      if (!res.ok) throw new Error("Falha ao gerar arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `notas_fiscais_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  // Filtragem multi-critérios
  const notasFiltradas = notas.filter(nota => {
    const termo = buscaInteligente.toLowerCase().trim();
    const matchBusca = !termo || 
      nota.numero_nf?.toLowerCase().includes(termo) ||
      nota.fornecedor_nome?.toLowerCase().includes(termo) ||
      nota.chave_acesso?.toLowerCase().includes(termo);

    const matchFornecedor = !fornecedorFiltro || String(nota.fornecedor_id) === String(fornecedorFiltro);

    let matchData = true;
    if (dataInicio && dataFim) {
      const dataEmissao = new Date(nota.data_emissao).toISOString().split('T')[0];
      matchData = dataEmissao >= dataInicio && dataEmissao <= dataFim;
    }

    let matchStatus = true;
    if (statusFiltro === 'atrasados') matchStatus = Number(nota.boletos_atrasados) > 0;
    if (statusFiltro === 'vencendo') matchStatus = Number(nota.boletos_vencendo_breve) > 0;
    if (statusFiltro === 'sem_boletos') matchStatus = Number(nota.total_boletos) === 0;

    return matchBusca && matchFornecedor && matchData && matchStatus;
  });

  const valorTotalFiltrado = notasFiltradas.reduce((acc, n) => acc + Number(n.valor_total || 0), 0);
  const totalAtrasados = notas.reduce((acc, n) => acc + Number(n.boletos_atrasados || 0), 0);
  const totalBreve = notas.reduce((acc, n) => acc + Number(n.boletos_vencendo_breve || 0), 0);

  // Paginação
  const totalPaginas = Math.ceil(notasFiltradas.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const notasPaginadas = notasFiltradas.slice(indexInicio, indexInicio + itensPorPagina);

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
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🧾</span> GESTÃO DE NOTAS E BOLETOS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Faturamento, compras e controle financeiro de títulos</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="🔍 Buscar nota, fornecedor ou chave..."
            className="px-4 py-2.5 border-2 border-slate-100 rounded-xl w-full md:w-80 outline-none focus:border-blue-500 transition-all text-xs font-bold bg-slate-50 text-slate-800"
            value={buscaInteligente}
            onChange={e => { setBuscaInteligente(e.target.value); setPaginaAtual(1); }}
          />

          <button 
            type="button"
            onClick={handleExportarExcel}
            disabled={exportando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black shadow-md text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            title="Exportar dados para Excel"
          >
            <span>📊</span> {exportando ? "..." : "Excel"}
          </button>

          <button 
            onClick={() => {
              setNovaNota({ numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '', data_emissao: '', data_recebimento: '', valor_total: '', descricao: '' });
              setArquivosNota({ xml: null, danfe: null });
              setItensNovosNota([]);
              setIsNovoCadastroItem(false);
              setModalNotaAberto(true);
            }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            + Lançar Nova Nota
          </button>
        </div>
      </div>

      {/* CARDS DE MONITORAMENTO INTERATIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button 
          type="button"
          onClick={() => { setStatusFiltro(statusFiltro === 'atrasados' ? 'todos' : 'atrasados'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            statusFiltro === 'atrasados' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white border-slate-100 hover:bg-red-50/50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest block ${statusFiltro === 'atrasados' ? 'text-red-100' : 'text-slate-400'}`}>Boletos Vencidos</span>
            <span className={`text-2xl font-black ${statusFiltro === 'atrasados' ? 'text-white' : 'text-red-600'}`}>{totalAtrasados} Pendentes</span>
          </div>
          <span className="text-2xl">🚨</span>
        </button>

        <button 
          type="button"
          onClick={() => { setStatusFiltro(statusFiltro === 'vencendo' ? 'todos' : 'vencendo'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            statusFiltro === 'vencendo' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white border-slate-100 hover:bg-amber-50/50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest block ${statusFiltro === 'vencendo' ? 'text-amber-100' : 'text-slate-400'}`}>Vencem nos Próx. 5 Dias</span>
            <span className={`text-2xl font-black ${statusFiltro === 'vencendo' ? 'text-white' : 'text-amber-600'}`}>{totalBreve} Parcela(s)</span>
          </div>
          <span className="text-2xl">⏳</span>
        </button>

        <button 
          type="button"
          onClick={() => { setStatusFiltro('todos'); setFornecedorFiltro(''); setBuscaInteligente(''); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            statusFiltro === 'todos' && !fornecedorFiltro && !buscaInteligente ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest block ${statusFiltro === 'todos' && !fornecedorFiltro && !buscaInteligente ? 'text-slate-400' : 'text-slate-400'}`}>Notas Cadastradas</span>
            <span className="text-2xl font-black">{notas.length} Documentos</span>
          </div>
          <span className="text-2xl">📑</span>
        </button>
      </div>

      {/* BARRA DE FILTROS AVANÇADOS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Fornecedor</label>
            <select
              className="px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={fornecedorFiltro}
              onChange={e => { setFornecedorFiltro(e.target.value); setPaginaAtual(1); }}
            >
              <option value="">Todos os Fornecedores</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Status Cobrança</label>
            <select
              className="px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={statusFiltro}
              onChange={e => { setStatusFiltro(e.target.value); setPaginaAtual(1); }}
            >
              <option value="todos">Todos os Status</option>
              <option value="atrasados">🚨 Atrasados</option>
              <option value="vencendo">⏰ Vencendo Breve</option>
              <option value="sem_boletos">⚪ Sem Boletos</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Emissão De</label>
            <input
              type="date"
              className="px-2.5 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={dataInicio}
              onChange={e => { setDataInicio(e.target.value); setPaginaAtual(1); }}
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Até</label>
            <input
              type="date"
              className="px-2.5 py-1.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
              value={dataFim}
              onChange={e => { setDataFim(e.target.value); setPaginaAtual(1); }}
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
                setPaginaAtual(1);
              }}
              className="mt-3 text-[10px] font-black text-red-500 hover:underline uppercase"
            >
              ✕ Limpar Filtros
            </button>
          )}
        </div>

        <div className="text-right">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Filtrado</span>
          <span className="text-lg font-black text-slate-800 font-mono">
            R$ {valorTotalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 animate-pulse">Carregando dados financeiros...</div>
        ) : notasFiltradas.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Nenhuma nota fiscal localizada com os filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 tracking-widest uppercase border-b border-slate-100">
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
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {notasPaginadas.map((nota) => (
                  <tr key={nota.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-5 font-bold text-slate-800 text-sm">
                      {nota.numero_nf} <span className="text-slate-400 font-normal text-xs">({nota.serie || 'Única'})</span>
                    </td>
                    <td className="p-5 text-xs font-bold text-slate-700 uppercase">{nota.fornecedor_nome}</td>
                    <td className="p-5 text-xs font-mono text-slate-500">{new Date(nota.data_emissao).toLocaleDateString('pt-BR')}</td>
                    <td className="p-5 font-black text-slate-800 font-mono text-sm">
                      R$ {Number(nota.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-5">
                      {renderizarBadgeAlerta(nota)}
                    </td>
                    <td className="p-5 space-x-1.5">
                      {nota.url_xml && <a href={`${API_URL.replace('/api', '')}${nota.url_xml}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-100">XML</a>}
                      {nota.url_danfe && <a href={`${API_URL.replace('/api', '')}${nota.url_danfe}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded-lg uppercase hover:bg-purple-600 hover:text-white transition-all border border-purple-100">DANFE</a>}
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => verItensNota(nota)} 
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 text-[11px] font-black uppercase tracking-wider"
                          title="Ver insumos lançados no estoque"
                        >
                          📦 Itens
                        </button>
                        <button onClick={() => verBoletos(nota)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100 text-[11px] font-black uppercase tracking-wider">
                          📁 Boletos ({nota.total_boletos || 0})
                        </button>
                        <button onClick={() => handleExcluirNota(nota.id)} className="p-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 text-xs" title="Remover Nota">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINAÇÃO */}
        {notasFiltradas.length > 0 && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">
              Exibindo <strong>{notasPaginadas.length}</strong> de <strong>{notasFiltradas.length}</strong> notas fiscais
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

      {/* --- MODAL 1: CADASTRAR NOTA + IMPORTAÇÃO AUTOMÁTICA DE XML --- */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[92vh] flex flex-col">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-blue-600 shrink-0">
              <span>🆕 Novo Lançamento Fiscal & Entrada de Estoque</span>
              <button onClick={() => setModalNotaAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={handleSalvarNota} className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* ⚡ BOTÃO DE LEITURA RÁPIDA DE XML */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-4 rounded-2xl border-2 border-dashed border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-left">
                  <span className="text-xs font-black text-blue-700 uppercase block flex items-center gap-1.5">
                    <span>⚡</span> Auto-Preenchimento via XML
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Selecione o arquivo XML da NF-e para carregar todos os dados e peças automaticamente.
                  </p>
                </div>
                <div>
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 inline-block text-center shrink-0">
                    📥 Carregar XML
                    <input type="file" accept=".xml" className="hidden" onChange={handleImportarXML} />
                  </label>
                </div>
              </div>

              {/* BLOCO 1: DADOS DA NOTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Número da NF *</label>
                  <input type="text" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm bg-white text-slate-800" value={novaNota.numero_nf} onChange={e => setNovaNota({...novaNota, numero_nf: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Série</label>
                  <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium bg-white text-slate-800" value={novaNota.serie} onChange={e => setNovaNota({...novaNota, serie: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chave de Acesso (44 dígitos)</label>
                  <input type="text" maxLength={44} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-xs bg-white text-slate-800 tracking-wider font-bold" value={novaNota.chave_acesso} onChange={e => setNovaNota({...novaNota, chave_acesso: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fornecedor Vinculado *</label>
                  <select required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm text-slate-800" value={novaNota.fornecedor_id} onChange={e => setNovaNota({...novaNota, fornecedor_id: e.target.value})}>
                    <option value="">Selecione o Fornecedor</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Emissão *</label>
                  <input type="date" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm bg-white text-slate-800 font-bold" value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Total (R$) *</label>
                  <input type="number" step="0.01" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-bold bg-white text-slate-800" value={novaNota.valor_total} onChange={e => setNovaNota({...novaNota, valor_total: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arquivo PDF DANFE (Opcional)</label>
                  <input type="file" accept=".pdf" className="w-full text-xs font-mono p-1" onChange={e => setArquivosNota({...arquivosNota, danfe: e.target.files[0]})} />
                </div>
              </div>

              {/* BLOCO 2: LANÇAMENTO / CADASTRO DE ITENS NO ESTOQUE */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>📦</span> Itens a Dar Entrada em Estoque ({itensNovosNota.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNovoCadastroItem(!isNovoCadastroItem);
                      setItemTemp({ item_id: '', nome: '', referencia: '', local_estoque_id: '', quantidade: '', valor_unitario: '' });
                    }}
                    className="text-[10px] font-black text-blue-600 hover:underline uppercase bg-blue-50 px-3 py-1 rounded-lg border border-blue-100"
                  >
                    {isNovoCadastroItem ? '← Selecionar Insumo Existente' : '➕ Incluir Manualmente'}
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  {!isNovoCadastroItem ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Insumo do Almoxarifado</label>
                        <select
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-blue-500"
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
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-blue-500"
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
                          + Incluir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                        <span>✨</span> Cadastrando Novo Insumo
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nome do Novo Insumo *</label>
                          <input
                            type="text"
                            placeholder="Ex: Disjuntor Bipolar 32A..."
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-blue-500"
                            value={itemTemp.nome}
                            onChange={e => setItemTemp({ ...itemTemp, nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Código / Referência</label>
                          <input
                            type="text"
                            placeholder="Ex: REF-9908"
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-medium focus:border-blue-500"
                            value={itemTemp.referencia}
                            onChange={e => setItemTemp({ ...itemTemp, referencia: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Local de Estoque</label>
                          <select
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold"
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
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-blue-500"
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
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-blue-500"
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
                          ✓ Adicionar Insumo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABELA DE ITENS INCLUÍDOS */}
                {itensNovosNota.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase sticky top-0">
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
                  <input type="text" className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold" value={novoBoleto.parcela} onChange={e => setNovoBoleto({...novoBoleto, parcela: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Valor da Parcela *</label>
                  <input type="number" step="0.01" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold" value={novoBoleto.valor_boleto} onChange={e => setNovoBoleto({...novoBoleto, valor_boleto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Data de Vencimento *</label>
                  <input type="date" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold" value={novoBoleto.data_vencimento} onChange={e => setNovoBoleto({...novoBoleto, data_vencimento: e.target.value})} />
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
                          <div className="text-xs text-slate-400 font-medium">Vencimento: <span className="font-mono text-slate-500 font-bold">{new Date(b.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></div>
                          <div className="flex gap-2 pt-1">
                            {b.url_boleto_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_boleto_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline">📄 Ver Duplicata</a>}
                            {b.url_comprovante_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_comprovante_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-green-600 hover:underline">🧾 Ver Recibo/Comprovante</a>}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-black text-slate-800 text-base font-mono">R$ {Number(b.valor_boleto).toFixed(2)}</div>
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

      {/* --- MODAL 3: ITENS DA NOTA E ENTRADA EM ESTOQUE --- */}
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
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-indigo-500"
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
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-indigo-500"
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
                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-slate-800 font-bold focus:border-indigo-500"
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