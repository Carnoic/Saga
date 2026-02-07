import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Download, FileText, Package, FileJson } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExportPage() {
  const { traineeProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (type: 'package' | 'pdf' | 'json') => {
    if (!traineeProfile?.id) {
      toast.error('Ingen profil att exportera');
      return;
    }

    setLoading(type);

    try {
      const filename = type === 'package'
        ? `export_${new Date().toISOString().split('T')[0]}.zip`
        : type === 'pdf'
        ? `sammanstallning_${new Date().toISOString().split('T')[0]}.pdf`
        : `export_${new Date().toISOString().split('T')[0]}.json`;

      await api.download(`/api/export/${type}/${traineeProfile.id}`, filename);
      toast.success('Export färdig!');
    } catch (error: any) {
      toast.error(error.message || 'Exporten misslyckades');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exportera</h1>
        <p className="text-gray-500">Skapa sammanställning för specialistansökan</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Full package */}
        <div className="card p-6">
          <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
            <Package className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-2">Komplett exportpaket</h2>
          <p className="text-sm text-gray-500 mb-4">
            ZIP-fil med PDF-sammanställning och alla uppladdade intyg som bilagor.
          </p>
          <button
            onClick={() => handleExport('package')}
            disabled={loading === 'package'}
            className="btn-primary w-full"
          >
            {loading === 'package' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporterar...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Ladda ner paket
              </span>
            )}
          </button>
        </div>

        {/* PDF only */}
        <div className="card p-6">
          <div className="w-12 h-12 bg-danger-50 rounded-lg flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-danger-500" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-2">PDF-sammanställning</h2>
          <p className="text-sm text-gray-500 mb-4">
            Endast PDF med sammanställning av alla uppgifter, utan bilagor.
          </p>
          <button
            onClick={() => handleExport('pdf')}
            disabled={loading === 'pdf'}
            className="btn-secondary w-full"
          >
            {loading === 'pdf' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                Genererar...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Ladda ner PDF
              </span>
            )}
          </button>
        </div>

        {/* JSON export */}
        <div className="card p-6">
          <div className="w-12 h-12 bg-warning-50 rounded-lg flex items-center justify-center mb-4">
            <FileJson className="w-6 h-6 text-warning-500" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-2">JSON-data</h2>
          <p className="text-sm text-gray-500 mb-4">
            All data i maskinläsbart JSON-format för backup eller dataportabilitet.
          </p>
          <button
            onClick={() => handleExport('json')}
            disabled={loading === 'json'}
            className="btn-secondary w-full"
          >
            {loading === 'json' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                Exporterar...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Ladda ner JSON
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card p-6 bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-2">Om exportpaketet</h3>
        <ul className="text-sm text-primary-800 space-y-1">
          <li>• PDF:en innehåller personuppgifter, placeringar, kurser, bedömningar och delmålsstatus</li>
          <li>• Alla uppladdade intyg inkluderas som separata filer i paketet</li>
          <li>• Exportpaketet kan användas som underlag vid specialistansökan</li>
          <li>• Framtida versioner kommer stödja automatisk ifyllning av Socialstyrelsens formulär</li>
        </ul>
      </div>
    </div>
  );
}
