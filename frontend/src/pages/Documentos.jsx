import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Documentos() {
  const [documentos, setDocumentos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  const [filtroEquipamento, setFiltroEquipamento] = useState('Todos');
  const [filtroTipoMidia, setFiltroTipoMidia] = useState('todos'); // 'todos', 'pdf', 'imagem'

  // Modal de Visualização Rápida
  const [previewArquivo, setPreviewArquivo] = useState(null);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 12;

  const API_URL = '/api';
  const BASE_URL = '';

  const carregarFiltrosEDados = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const user = savedUser ? JSON.parse(savedUser) : null;
      const headers = {
        'Content-Type': 'application/json',
        'x-usuario-nivel': user?.nivel || ''
      };

      const [resDocs, resSetores, resEquips] = await Promise.all([
        fetch(`${API_URL}/documentos`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/setores`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/equipamentos`, { headers }).then(res => res.json())
      ]);

      setDocumentos(resDocs || []);
      setSetores(resSetores || []);
      setEquipamentos(resEquips || []);
    } catch (err) {
      console.error("Erro ao carregar repositório de documentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFiltrosEDados();
  }, []);

  // Lógica de Filtragem
  const documentosFiltrados = documentos.filter(doc => {
    const termo = buscaGlobal.trim().toLowerCase();

    const bateSetorSelect = filtroSetor === 'Todos' || doc.setor_id?.toString() === filtroSetor;
    const bateEquipSelect = filtroEquipamento === 'Todos' || doc.equipamento_id?.toString() === filtroEquipamento;
    
    let bateMidia = true;
    if (filtroTipoMidia === 'pdf') bateMidia = doc.tipo_mimetype?.includes('pdf');
    if (filtroTipoMidia === 'imagem') bateMidia = !doc.tipo_mimetype?.includes('pdf');

    if (termo === '') {
      return bateSetorSelect && bateEquipSelect && bateMidia;
    }

    const bateOS = doc.chamado_id?.toString().includes(termo);
    const bateNomeOriginal = doc.nome_original?.toLowerCase().includes(termo);
    const bateUsuario = doc.usuario_nome?.toLowerCase().includes(termo);
    const bateSetorTexto = doc.setor_nome?.toLowerCase().includes(termo);
    const batePatrimonio = doc.equipamento_patrimonio?.toLowerCase().includes(termo);
    const bateEquipNome = doc.equipamento_name?.toLowerCase().includes(termo) || doc.equipamento_nome?.toLowerCase().includes(termo);

    const bateBuscaGlobal = bateOS || bateNomeOriginal || bateUsuario || bateSetorTexto || batePatrimonio || bateEquipNome;

    return bateBuscaGlobal && bateSetorSelect && bateEquipSelect && bateMidia;
  });

  // Métricas / KPIs
  const totalArquivos = documentos.length;
  const totalPDFs = documentos.filter(d => d.tipo_mimetype?.includes('pdf')).length;
  const totalImagens = totalArquivos - totalPDFs;

  // Paginação
  const totalPaginas = Math.ceil(documentosFiltrados.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const documentosPaginados = documentosFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) return (
    <div className="p-12 text-center font-bold text-slate-400 uppercase text-xs tracking-widest animate-pulse">
      Carregando repositório de laudos e auditoria técnica...
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800 w-full max-w-full overflow-x-hidden">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">📁</span> REPOSITÓRIO DE DOCUMENTOS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Laudos, certificados de calibração e histórico de ordens de serviço
          </p>
        </div>
        <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl uppercase tracking-wider">
          🔒 Repositório Auditável
        </span>
      </div>

      {/* CARDS DE RESUMO (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          type="button"
          onClick={() => { setFiltroTipoMidia('todos'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            filtroTipoMidia === 'todos' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-800 border-slate-100 hover:bg-slate-50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${filtroTipoMidia === 'todos' ? 'text-slate-400' : 'text-slate-400'}`}>Total de Arquivos</span>
            <p className="text-xl font-black mt-0.5">{totalArquivos} Anexos</p>
          </div>
          <span className="text-lg">📦</span>
        </button>

        <button
          type="button"
          onClick={() => { setFiltroTipoMidia('pdf'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            filtroTipoMidia === 'pdf' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-800 border-slate-100 hover:bg-slate-50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${filtroTipoMidia === 'pdf' ? 'text-blue-200' : 'text-slate-400'}`}>Laudos em PDF</span>
            <p className={`text-xl font-black mt-0.5 ${filtroTipoMidia === 'pdf' ? 'text-white' : 'text-blue-600'}`}>{totalPDFs} Documentos</p>
          </div>
          <span className="text-lg">📄</span>
        </button>

        <button
          type="button"
          onClick={() => { setFiltroTipoMidia('imagem'); setPaginaAtual(1); }}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
            filtroTipoMidia === 'imagem' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-800 border-slate-100 hover:bg-slate-50'
          }`}
        >
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${filtroTipoMidia === 'imagem' ? 'text-purple-200' : 'text-slate-400'}`}>Fotos e Evidências</span>
            <p className={`text-xl font-black mt-0.5 ${filtroTipoMidia === 'imagem' ? 'text-white' : 'text-purple-600'}`}>{totalImagens} Imagens</p>
          </div>
          <span className="text-lg">📷</span>
        </button>
      </div>

      {/* PAINEL DE BUSCA E FILTROS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 space-y-4 w-full">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
          Filtros de Auditoria
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
          <div className="lg:col-span-6">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Busca Rápida Unificada</label>
            <input 
              type="text" 
              placeholder="🔍 Digite Nº da OS, Patrimônio, Nome do Arquivo, Setor ou Operador..." 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-all text-slate-800"
              value={buscaGlobal}
              onChange={e => { setBuscaGlobal(e.target.value); setPaginaAtual(1); }}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Isolar por Setor</label>
            <select 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-700"
              value={filtroSetor}
              onChange={e => { setFiltroSetor(e.target.value); setPaginaAtual(1); }}
            >
              <option value="Todos">⭐ Todos os Setores</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Isolar por Equipamento</label>
            <select 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-700"
              value={filtroEquipamento}
              onChange={e => { setFiltroEquipamento(e.target.value); setPaginaAtual(1); }}
            >
              <option value="Todos">⭐ Todos os Equipamentos</option>
              {equipamentos.map(e => <option key={e.id} value={e.id}>[{e.patrimonio || 'S/P'}] {e.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE DOCUMENTOS */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden w-full space-y-4 p-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Documentos e Laudos Arquivados
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            {documentosFiltrados.length} Registros Encontrados
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase border-b border-slate-100">
                <th className="p-3.5 w-[35%]">Arquivo / Tipo</th>
                <th className="p-3.5 w-[30%]">Vínculos no Sistema</th>
                <th className="p-3.5 w-[15%]">Data de Envio</th>
                <th className="p-3.5 w-[10%]">Responsável</th>
                <th className="p-3.5 text-center w-[10%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {documentosPaginados.map((doc) => {
                const isPdf = doc.tipo_mimetype?.includes('pdf');
                const urlCompleta = `${BASE_URL}${doc.url_arquivo}`;

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* ARQUIVO */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        {isPdf ? (
                          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-black text-sm shrink-0 border border-red-100">
                            PDF
                          </div>
                        ) : (
                          <img 
                            src={urlCompleta} 
                            alt={doc.nome_original} 
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewArquivo({ url: urlCompleta, nome: doc.nome_original, tipo: 'imagem' })}
                          />
                        )}
                        <div className="min-w-0">
                          <span className="font-black text-slate-800 block uppercase truncate max-w-xs" title={doc.nome_original}>
                            {doc.nome_original}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono truncate">{doc.tipo_mimetype}</span>
                        </div>
                      </div>
                    </td>

                    {/* VÍNCULOS */}
                    <td className="p-3.5 space-y-1">
                      {doc.chamado_id && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black inline-block mr-1">
                          🎫 OS #{doc.chamado_id}
                        </span>
                      )}
                      {doc.setor_nome && (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold inline-block mr-1">
                          📍 {doc.setor_nome}
                        </span>
                      )}
                      {(doc.equipamento_name || doc.equipamento_nome) && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold block truncate max-w-xs mt-0.5" title={doc.equipamento_name || doc.equipamento_nome}>
                          🛠️ {doc.equipamento_patrimonio ? `[${doc.equipamento_patrimonio}] ` : ''}{doc.equipamento_name || doc.equipamento_nome}
                        </span>
                      )}
                    </td>

                    {/* DATA */}
                    <td className="p-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(doc.data_upload).toLocaleString('pt-BR')}
                    </td>

                    {/* RESPONSÁVEL */}
                    <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {doc.usuario_nome || 'Sistema'}
                    </td>

                    {/* AÇÕES */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewArquivo({ url: urlCompleta, nome: doc.nome_original, tipo: isPdf ? 'pdf' : 'imagem' })}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95"
                        >
                          Visualizar
                        </button>
                        <a 
                          href={urlCompleta} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition-all"
                          title="Abrir em nova aba"
                        >
                          ↗
                        </a>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {documentosFiltrados.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-bold italic w-full">
            Nenhum documento ou laudo atende aos critérios da busca ou filtros aplicados.
          </div>
        )}

        {/* PAGINAÇÃO */}
        {documentosFiltrados.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 mt-4">
            <span className="text-[10px] font-bold text-slate-400">
              Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaAtual === totalPaginas}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE PREVIEW / VISUALIZAÇÃO DIRETA */}
      {previewArquivo && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewArquivo(null)}
        >
          <div 
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <span className="font-black text-xs uppercase tracking-wider truncate max-w-lg">
                📄 {previewArquivo.nome}
              </span>
              <div className="flex items-center gap-2">
                <a 
                  href={previewArquivo.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase"
                >
                  Abrir Original ↗
                </a>
                <button 
                  onClick={() => setPreviewArquivo(null)}
                  className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-black text-xs flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100 min-h-[400px]">
              {previewArquivo.tipo === 'imagem' ? (
                <img 
                  src={previewArquivo.url} 
                  alt={previewArquivo.nome} 
                  className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-md" 
                />
              ) : (
                <iframe 
                  src={previewArquivo.url} 
                  title={previewArquivo.nome}
                  className="w-full h-[75vh] rounded-2xl border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}