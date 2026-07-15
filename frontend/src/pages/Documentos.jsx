import { useEffect, useState } from 'react';

export default function Documentos() {
  const [documentos, setDocumentos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado de Busca Única (Unificada)
  const [buscaGlobal, setBuscaGlobal] = useState('');
  
  // Filtros de seleção opcionais (preservados para isolamento rápido)
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  const [filtroEquipamento, setFiltroEquipamento] = useState('Todos');

  const API_URL = 'http://192.168.5.101:3000/api';
  const BASE_URL = 'http://192.168.5.101:3000';

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

  // Lógica de Filtragem Unificada (Varre múltiplos campos com um único termo)
  const documentosFiltrados = documentos.filter(doc => {
    const termo = buscaGlobal.trim().toLowerCase();

    // Filtros de Select (Isolamento rápido)
    const bateSetorSelect = filtroSetor === 'Todos' || doc.setor_id?.toString() === filtroSetor;
    const bateEquipSelect = filtroEquipamento === 'Todos' || doc.equipamento_id?.toString() === filtroEquipamento;

    // Se não há busca digitada, valida apenas os selects
    if (termo === '') {
      return bateSetorSelect && bateEquipSelect;
    }

    // Varredura Multi-campo Inteligente
    const bateOS = doc.chamado_id?.toString().includes(termo);
    const bateNomeOriginal = doc.nome_original?.toLowerCase().includes(termo);
    const bateUsuario = doc.usuario_nome?.toLowerCase().includes(termo);
    const bateSetorTexto = doc.setor_nome?.toLowerCase().includes(termo);
    const batePatrimonio = doc.equipamento_patrimonio?.toLowerCase().includes(termo);
    const bateEquipNome = doc.equipamento_name?.toLowerCase().includes(termo) || doc.equipamento_nome?.toLowerCase().includes(termo);

    const bateBuscaGlobal = bateOS || bateNomeOriginal || bateUsuario || bateSetorTexto || batePatrimonio || bateEquipNome;

    return bateBuscaGlobal && bateSetorSelect && bateEquipSelect;
  });

  if (loading) return <div className="p-8 text-center font-bold">Carregando repositório de arquivos auditáveis...</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans text-slate-800 w-full max-w-full overflow-x-hidden">
      
      {/* HEADER AJUSTADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3 truncate">
            <span className="bg-blue-100 p-2 rounded-xl text-blue-600 shrink-0">📁</span>
            REPOSITÓRIO DE DOCUMENTOS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider truncate">Laudos, certificados de calibração e histórico de ordens de serviço</p>
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg shrink-0">
          🔒 Histórico Geral de Laudos e Auditoria
        </p>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS UNIFICADO */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 space-y-4 w-full">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Busca Dinâmica de Documentos</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-dark w-full">
          {/* CAMPO DE BUSCA UNIFICADA */}
          <div className="lg:col-span-6">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Busca Rápida Unificada</label>
            <input 
              type="text" 
              placeholder="🔍 Digite a OS, Patrimônio, Quarto, Nome do Arquivo ou Operador..." 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-all text-black"
              value={buscaGlobal}
              onChange={e => setBuscaGlobal(e.target.value)}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Isolar por Setor</label>
            <select 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-white outline-none text-black"
              value={filtroSetor}
              onChange={e => setFiltroSetor(e.target.value)}
            >
              <option value="Todos">Todos os Setores</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Equipamento / Ativo</label>
            <select 
              className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-white outline-none text-black"
              value={filtroEquipamento}
              onChange={e => setFiltroEquipamento(e.target.value)}
            >
              <option value="Todos">Todos os Equipamentos</option>
              {equipamentos.map(e => <option key={e.id} value={e.id}>[{e.patrimonio || 'S/P'}] {e.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA REGISTRADORA COM PROTEÇÃO CONTRA ESTOURO DE TELA */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden w-full">
        {/* 🛠️ CONTÊINER ANTIBREAK CORRIGIDO: Permite scroll horizontal isolado caso a tabela fique maior que a tela */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-100 text-slate-400 font-black text-[10px] uppercase border-b border-slate-200">
                <th className="p-4 w-[35%]">Arquivo</th>
                <th className="p-4 w-[35%]">Vínculos Sistema</th>
                <th className="p-4 w-[15%]">Firmado Em</th>
                <th className="p-4 w-[10%]">Responsável</th>
                <th className="p-4 text-center w-[5%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {documentosFiltrados.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2 max-w-xs sm:max-w-md">
                      <span className="text-lg shrink-0">{doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'}</span>
                      <div className="min-w-0">
                        <span className="font-black text-slate-800 block uppercase truncate" title={doc.nome_original}>
                          {doc.nome_original}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono truncate">{doc.tipo_mimetype}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 space-y-1">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black block w-max">🎫 OS: #{doc.chamado_id}</span>
                    {doc.setor_nome && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] block w-max font-bold">📍 {doc.setor_nome}</span>}
                    {doc.equipamento_name ? (
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold block w-max truncate max-w-xs" title={doc.equipamento_name}>
                        🛠️ {doc.equipamento_patrimonio ? `[${doc.equipamento_patrimonio}] ` : ''}{doc.equipamento_name}
                      </span>
                    ) : doc.equipamento_nome ? (
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold block w-max truncate max-w-xs" title={doc.equipamento_nome}>
                        🛠️ {doc.equipamento_patrimonio ? `[${doc.equipamento_patrimonio}] ` : ''}{doc.equipamento_nome}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 text-slate-500 whitespace-nowrap">
                    {new Date(doc.data_upload).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                    {doc.usuario_nome}
                  </td>
                  <td className="p-4 text-center">
                    <a 
                      href={`${BASE_URL}${doc.url_arquivo}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-950 shadow-sm transition-all inline-block whitespace-nowrap"
                    >
                      Visualizar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {documentosFiltrados.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-bold italic w-full">
            Nenhum documento ou laudo atende aos critérios da busca ou filtros aplicados.
          </div>
        )}
      </div>

    </div>
  );
}