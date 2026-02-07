import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { formatDateSv, CERTIFICATE_TYPE_LABELS, CertificateType } from '@saga/shared';
import { FileText, Upload, Trash2, Eye, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CertificatesPage() {
  const { traineeProfile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    type: 'OVRIGT' as CertificateType,
    title: '',
    issuer: '',
    issueDate: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingCert, setViewingCert] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', traineeProfile?.id],
    queryFn: () => api.get(`/api/certificates?traineeProfileId=${traineeProfile?.id}`),
    enabled: !!traineeProfile?.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => api.upload('/api/certificates/upload', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Intyg uppladdat');
      resetUploadForm();
    },
    onError: (error: any) => toast.error(error.message || 'Kunde inte ladda upp intyg'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Intyg borttaget');
    },
    onError: () => toast.error('Kunde inte ta bort intyg'),
  });

  const resetUploadForm = () => {
    setUploadForm({ type: 'OVRIGT', title: '', issuer: '', issueDate: '' });
    setSelectedFile(null);
    setShowUpload(false);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Välj en fil att ladda upp');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('traineeProfileId', traineeProfile?.id || '');
    formData.append('type', uploadForm.type);
    if (uploadForm.title) formData.append('title', uploadForm.title);
    if (uploadForm.issuer) formData.append('issuer', uploadForm.issuer);
    if (uploadForm.issueDate) formData.append('issueDate', uploadForm.issueDate);

    uploadMutation.mutate(formData);
  };

  const certificates = data?.certificates || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intyg</h1>
          <p className="text-gray-500">{certificates.length} intyg uppladdade</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Upload className="w-4 h-4 mr-2" />
          Ladda upp intyg
        </button>
      </div>

      {/* Certificates grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 h-40"></div>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Inga intyg uppladdade</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary mt-4">
            Ladda upp ditt första intyg
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert: any) => (
            <div key={cert.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="badge-primary">
                  {CERTIFICATE_TYPE_LABELS[cert.type as CertificateType]}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewingCert(cert)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Vill du ta bort detta intyg?')) {
                        deleteMutation.mutate(cert.id);
                      }
                    }}
                    className="p-1 text-gray-500 hover:text-danger-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-medium text-gray-900 truncate">
                {cert.title || cert.fileName}
              </h3>
              {cert.issuer && <p className="text-sm text-gray-500">{cert.issuer}</p>}
              {cert.issueDate && (
                <p className="text-sm text-gray-500">{formatDateSv(cert.issueDate)}</p>
              )}
              <div className="mt-2 text-xs text-gray-400">{cert.fileName}</div>
              {cert.ocrProcessedAt && (
                <div className="mt-2">
                  <span className="badge-success text-xs">OCR bearbetat</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ladda upp intyg</h2>
              <button onClick={resetUploadForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-4 space-y-4">
              <div>
                <label className="label">Fil *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG, GIF eller PDF (max 10MB)</p>
              </div>
              <div>
                <label className="label">Typ *</label>
                <select
                  className="input"
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value as CertificateType })}
                >
                  {Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Titel</label>
                <input
                  type="text"
                  className="input"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Utfärdare</label>
                <input
                  type="text"
                  className="input"
                  value={uploadForm.issuer}
                  onChange={(e) => setUploadForm({ ...uploadForm, issuer: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Utfärdandedatum</label>
                <input
                  type="date"
                  className="input"
                  value={uploadForm.issueDate}
                  onChange={(e) => setUploadForm({ ...uploadForm, issueDate: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetUploadForm} className="btn-secondary flex-1">
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {uploadMutation.isPending ? 'Laddar upp...' : 'Ladda upp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewingCert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{viewingCert.title || viewingCert.fileName}</h2>
              <button onClick={() => setViewingCert(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Typ</p>
                  <p className="font-medium">{CERTIFICATE_TYPE_LABELS[viewingCert.type as CertificateType]}</p>
                </div>
                <div>
                  <p className="text-gray-500">Utfärdare</p>
                  <p className="font-medium">{viewingCert.issuer || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Utfärdandedatum</p>
                  <p className="font-medium">
                    {viewingCert.issueDate ? formatDateSv(viewingCert.issueDate) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Filstorlek</p>
                  <p className="font-medium">{Math.round(viewingCert.fileSize / 1024)} KB</p>
                </div>
              </div>

              {viewingCert.ocrText && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">OCR-extraherad text</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {viewingCert.ocrText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
