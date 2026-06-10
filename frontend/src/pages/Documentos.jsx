import { useEffect, useState } from 'react';

export default function Documentos() {
  const [documentos, setDocumentos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Filtros
  const [buscaOs, setBuscaOs] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  const [filtroEquipamento, setFiltroEquipamento] = useState('Todos');
  const [buscaNome, setBuscaNome] = useState('');

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

  // Lógica de Filtragem Avançada para Auditoria
  const documentosFiltrados = documentos.filter(doc => {
    const bateOS = buscaOs === '' || doc.chamado_id?.toString() === buscaOs.trim();
    const bateSetor = filtroSetor === 'Todos' || doc.setor_id?.toString() === filtroSetor;
    const bateEquip = filtroEquipamento === 'Todos' || doc.equipamento_id?.toString() === filtroEquipamento;
    const bateNome = buscaNome === '' || doc.nome_original?.toLowerCase().includes(buscaNome.toLowerCase()) || doc.usuario_nome?.toLowerCase().includes(buscaNome.toLowerCase());

    return bateOS && bateSetor && bateEquip && bateNome;
  });

  if (loading) return <div className="p-8 text-center font-bold">Carregando repositório de arquivos auditáveis...</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <span className="bg-blue-100 p-2 rounded-xl text-blue-600">📁</span>
          REPOSITÓRIO DE DOCUMENTOS
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg">
          🔒 Histórico Geral de Laudos e Auditoria
        </p>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-dark">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Filtrar por OS Específica</label>
          <input 
            type="number" 
            placeholder="Ex: 4582" 
            className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold outline-none bg-white"
            value={buscaOs}
            onChange={e => setBuscaOs(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Setor</label>
          <select 
            className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
            value={filtroSetor}
            onChange={e => setFiltroSetor(e.target.value)}
          >
            <option value="Todos">Todos os Setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Equipamento / Ativo</label>
          <select 
            className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
            value={filtroEquipamento}
            onChange={e => setFiltroEquipamento(e.target.value)}
          >
            <option value="Todos">Todos os Equipamentos</option>
            {equipamentos.map(e => <option key={e.id} value={e.id}>[{e.patrimonio}] {e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Buscar por Nome / Operador</label>
          <input 
            type="text" 
            placeholder="Buscar termo..." 
            className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold outline-none bg-white"
            value={buscaNome}
            onChange={e => setBuscaNome(e.target.value)}
          />
        </div>
      </div>

      {/* TABELA REGISTRADORA (AUDITORIA) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-400 font-black text-[10px] uppercase border-b border-slate-200">
                <th className="p-4">Arquivo</th>
                <th className="p-4">Vínculos Sistema</th>
                <th className="p-4">Firmado Em</th>
                <th className="p-4">Responsável</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {documentosFiltrados.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'}</span>
                      <div>
                        <span className="font-black text-slate-800 block uppercase max-w-xs truncate" title={doc.nome_original}>
                          {doc.nome_original}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">{doc.tipo_mimetype}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 space-y-0.5">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black block w-max">🎫 OS: #{doc.chamado_id}</span>
                    {doc.setor_nome && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] block w-max">📍 {doc.setor_nome}</span>}
                    {doc.equipamento_name && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] block w-max">🤖 {doc.equipamento_name}</span>}
                  </td>
                  <td className="p-4 text-slate-500">
                    {new Date(doc.data_upload).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-4 font-bold text-slate-800">
                    {doc.usuario_nome}
                  </td>
                  <td className="p-4 text-center">
                    <a 
                      href={`${BASE_URL}${doc.url_arquivo}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-950 shadow-sm transition-all"
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
          <div className="p-12 text-center text-slate-400 font-bold italic">
            Nenhum documento ou laudo atende aos critérios dos filtros aplicados.
          </div>
        )}
      </div>

    </div>
  );
}