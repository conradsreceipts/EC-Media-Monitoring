import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BarChart3, 
  Newspaper, 
  MapPin, 
  ShieldAlert,
  ShieldCheck,
  Cpu,
  FileText,
  Check,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  ExternalLink,
  Filter,
  Info,
  Calendar,
  Building2,
  Users,
  Briefcase,
  Flag,
  ChevronDown,
  Layers,
  Key,
  Settings2,
  X,
  CalendarDays,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Zap,
  Tag,
  Plus,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { runMonitoring, generateArticleSummary } from './services/geminiService';
import { MonitoringReport, Article, MonitoringConfig, ReportData, PDFArticleCluster } from './types';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { MediaIntelligencePDF } from './components/MediaIntelligencePDF';

export default function App() {
  const [config, setConfig] = useState<MonitoringConfig>({
    dateRange: '24h',
    provincial: {
      executive: {
        enabled: true,
        subSections: {
          'Premier': true,
          'MEC': true,
          'Director General': true,
          'Head of Department': true
        }
      },
      delivery: {
        enabled: true,
        subSections: {
          'Health': true,
          'Education': true,
          'Public Works': true,
          'Social Development': true,
          'Agriculture': true,
          'Economic Development': true,
          'Transport': true,
          'Human Settlements': true
        }
      }
    },
    local: {
      executive: {
        enabled: true,
        subSections: {
          'Mayor': true,
          'Municipal Manager': true,
          'Council Speaker': true
        }
      },
      delivery: {
        enabled: true,
        subSections: {
          'Water & Sanitation': true,
          'Electricity': true,
          'Waste Management': true,
          'Roads & Stormwater': true,
          'Housing': true,
          'Community Safety': true
        }
      }
    },
    includePoliticalParties: false
  });
  
  const [report, setReport] = useState<MonitoringReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [subProcess, setSubProcess] = useState<string>("");
  const stages = [
    { id: 1, name: "Initialization", desc: "Setting up monitoring parameters", icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 2, name: "Discovery", desc: "Searching Google & RSS feeds", icon: <Search className="w-3.5 h-3.5" /> },
    { id: 3, name: "Verification", desc: "Verifying source authenticity", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 4, name: "Inference", desc: "Semantic analysis & classification", icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 5, name: "Finalizing", desc: "Generating intelligence report", icon: <FileText className="w-3.5 h-3.5" /> }
  ];
  const [error, setError] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [activeSubModal, setActiveSubModal] = useState<{
    type: 'provincial' | 'local';
    category: 'executive' | 'delivery';
  } | null>(null);
  const [showRunDropdown, setShowRunDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activityLog]);

  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const [sort, setSort] = useState<{ field: 'date' | 'relevance' | 'risk', direction: 'asc' | 'desc' }>({
    field: 'date',
    direction: 'desc'
  });
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterSpheres, setFilterSpheres] = useState<string[]>([]);
  const [filterRisks, setFilterRisks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleMonitor = async (range?: MonitoringConfig['dateRange']) => {
    const finalConfig = range ? { ...config, dateRange: range } : config;
    if (range === 'custom' && !showCustomDate) {
      setShowCustomDate(true);
      setShowRunDropdown(false);
      return;
    }
    
    setLoading(true);
    setLoadingStatus("Initializing...");
    setLoadingStage(1);
    setActivityLog(["System: Initializing Media Intelligence Discovery..."]);
    setError(null);
    setShowRunDropdown(false);
    setShowCompletionPopup(false);

    try {
      const result = await runMonitoring(finalConfig, userApiKey || undefined, (partialReport, status) => {
        // We do NOT update the report here to prevent the dashboard from collapsing
        // and causing the page to scroll to the top. We only update the loading status.
        setLoadingStatus(status);
        
        // Extract sub-process from status (remove timestamp and tags)
        const cleanStatus = status.replace(/\[.*\]\s*/, '').replace(/^[A-Z]+:\s*/, '');
        setSubProcess(cleanStatus);

        // Update stage based on status keywords
        if (status.includes("NETWORK: Dispatching search")) setLoadingStage(2);
        if (status.includes("SYSTEM: Discovery phase complete")) setLoadingStage(3);
        if (status.includes("SYSTEM: Initializing Semantic Verification")) setLoadingStage(4);
        if (status.includes("SYSTEM: Finalizing report")) setLoadingStage(5);

        setActivityLog(prev => {
          const newLog = [...prev, status];
          // Keep more items for a better history
          return newLog.slice(-50);
        });
      });
      setReport(result);
    } catch (err) {
      console.error(err);
      setError('Failed to run monitoring. Please check your API key and network connection.');
    } finally {
      setLoading(false);
      setLoadingStatus("");
      setLoadingStage(0);
      setShowCompletionPopup(true);
    }
  };

  const handleCustomDateSubmit = () => {
    if (!customDates.start || !customDates.end) return;
    const finalConfig = { ...config, dateRange: 'custom' as const, customDateRange: customDates };
    setConfig(finalConfig);
    setShowCustomDate(false);
    handleMonitor('custom');
  };

  const groupArticles = (articles: Article[]) => {
    let filtered = [...articles];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(a => 
        a.article_title.toLowerCase().includes(term) || 
        a.summary_1_sentence?.toLowerCase().includes(term) ||
        a.source_name.toLowerCase().includes(term) ||
        a.primary_entity?.toLowerCase().includes(term) ||
        a.secondary_entities?.some(e => e.toLowerCase().includes(term)) ||
        a.user_tags?.some(t => t.toLowerCase().includes(term))
      );
    }
    if (filterTags.length > 0) {
      filtered = filtered.filter(a => a.user_tags?.some(tag => filterTags.includes(tag)));
    }
    if (filterSpheres.length > 0) {
      filtered = filtered.filter(a => filterSpheres.includes(a.sphere_of_government));
    }
    if (filterRisks.length > 0) {
      filtered = filtered.filter(a => filterRisks.includes(a.reputational_risk));
    }
    const sorted = filtered.sort((a, b) => {
      if (sort.field === 'date') {
        const dateA = new Date(a.publication_date).getTime();
        const dateB = new Date(b.publication_date).getTime();
        return sort.direction === 'desc' ? dateB - dateA : dateA - dateB;
      }
      if (sort.field === 'risk') {
        const riskMap: { [key: string]: number } = { 'Critical': 4, 'High': 3, 'Moderate': 2, 'Low': 1, 'None': 0 };
        const riskA = riskMap[a.reputational_risk] || 0;
        const riskB = riskMap[b.reputational_risk] || 0;
        return sort.direction === 'desc' ? riskB - riskA : riskA - riskB;
      }
      return 0;
    });

    const groups: { [key: string]: Article[] } = {};
    sorted.forEach(article => {
      const id = article.duplicate_cluster_id || article.article_url;
      if (!groups[id]) groups[id] = [];
      groups[id].push(article);
    });

    // Ensure primary article (not syndicated) is first in each group
    Object.keys(groups).forEach(id => {
      groups[id].sort((a, b) => {
        if (a.is_duplicate_or_syndicated === b.is_duplicate_or_syndicated) return 0;
        return a.is_duplicate_or_syndicated ? 1 : -1;
      });
    });

    return groups;
  };

  const topEntities = useMemo(() => {
    if (!report) return [];
    const entityCounts: { [key: string]: number } = {};
    report.articles.forEach(article => {
      if (article.primary_entity) {
        entityCounts[article.primary_entity] = (entityCounts[article.primary_entity] || 0) + 1;
      }
      article.secondary_entities?.forEach(entity => {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      });
    });

    return Object.entries(entityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);
  }, [report]);

  const handleUpdateArticleTags = (articleUrl: string, tags: string[]) => {
    if (!report) return;
    const updatedArticles = report.articles.map(article => 
      article.article_url === articleUrl ? { ...article, user_tags: tags } : article
    );
    setReport({ ...report, articles: updatedArticles });
    if (selectedArticle && selectedArticle.article_url === articleUrl) {
      setSelectedArticle({ ...selectedArticle, user_tags: tags });
    }
  };

  const handleGenerateSummary = async (articleUrl: string) => {
    if (!report) return;
    const article = report.articles.find(a => a.article_url === articleUrl);
    if (!article) return;
    
    try {
      const summary = await generateArticleSummary(article, userApiKey || undefined);
      const updatedArticles = report.articles.map(a => 
        a.article_url === articleUrl ? { ...a, summary_1_sentence: summary } : a
      );
      setReport({ ...report, articles: updatedArticles });
      if (selectedArticle && selectedArticle.article_url === articleUrl) {
        setSelectedArticle({ ...selectedArticle, summary_1_sentence: summary });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTagClick = (tag: string) => {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const preparePDFData = (): ReportData => {
    if (!report) return { clusters: {} };
    const grouped = groupArticles(report.articles);
    const pdfClusters: { [key: string]: PDFArticleCluster[] } = {};
    
    // Group by sphere of government for the PDF report
    Object.values(grouped).forEach(articles => {
      const primary = articles[0];
      const category = primary.sphere_of_government || 'Uncategorized';
      if (!pdfClusters[category]) pdfClusters[category] = [];
      pdfClusters[category].push({
        articles,
        summary: primary.summary_1_paragraph
      });
    });
    
    return { clusters: pdfClusters };
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="bg-[#004A99] p-1.5 sm:p-2 rounded-lg">
                <ShieldAlert className="text-white w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#004A99] truncate">EC Media Intelligence</h1>
                <p className="text-[9px] sm:text-xs text-gray-500 font-medium uppercase tracking-widest truncate">Office of the Premier</p>
              </div>
            </div>
            <div className={`flex items-center ${orientation === 'portrait' ? 'gap-2' : 'gap-4'}`}>
              <button
                onClick={() => setShowConfig(true)}
                className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all ${orientation === 'portrait' ? 'p-2' : ''}`}
              >
                <Settings2 className="w-4 h-4" />
                {orientation === 'landscape' && 'Configure'}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                    userApiKey 
                      ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  } ${orientation === 'portrait' ? 'p-2' : ''}`}
                >
                  <Key className="w-4 h-4" />
                  {orientation === 'landscape' && (userApiKey ? 'API Key Set' : 'Provide API Key')}
                </button>
                
                <AnimatePresence>
                  {showKeyInput && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl p-4 z-50"
                    >
                      <h3 className="text-sm font-bold mb-2">Enter Gemini API Key</h3>
                      <input
                        type="password"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#004A99] outline-none mb-3"
                      />
                      <p className="text-[10px] text-gray-400 mb-3">
                        Your key is used locally for this session and not stored on our servers.
                      </p>
                      <button
                        onClick={() => setShowKeyInput(false)}
                        className="w-full py-2 bg-[#004A99] text-white rounded-lg text-xs font-bold hover:bg-[#003366] transition-colors"
                      >
                        Done
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowRunDropdown(!showRunDropdown)}
                  disabled={loading}
                  className={`bg-[#004A99] hover:bg-[#003366] text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50 ${orientation === 'portrait' ? 'px-4 py-2' : 'px-6 py-2.5'}`}
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {orientation === 'landscape' ? (loading ? 'Running Monitor...' : 'Run Monitor') : (loading ? '' : 'Run')}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRunDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showRunDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden z-50"
                    >
                      <div className="p-2 space-y-1">
                        {[
                          { id: '24h', label: 'Last 24 Hours' },
                          { id: '72h', label: 'Last 72 Hours' },
                          { id: '7d', label: 'Last 7 Days' },
                          { id: '14d', label: 'Last 14 Days' },
                          { id: '21d', label: 'Last 21 Days' },
                          { id: '28d', label: 'Last 28 Days' },
                          { id: '3m', label: 'Last 3 Months' },
                          { id: 'custom', label: 'Custom Range', icon: <Calendar className="w-3 h-3" /> }
                        ].map((range) => (
                          <button
                            key={range.id}
                            onClick={() => handleMonitor(range.id as any)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-xl flex items-center justify-between group"
                          >
                            {range.label}
                            {range.id === 'custom' ? <Calendar className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#004A99]" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showConfig && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-[#004A99] p-2 rounded-xl">
                    <Settings2 className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Monitoring Configuration</h2>
                    <p className="text-xs text-gray-500 font-medium">Fine-tune your media intelligence parameters</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfig(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Provincial Government */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Building2 className="w-6 h-6 text-[#004A99]" />
                      <h3 className="text-lg font-bold">Provincial Government</h3>
                    </div>

                    <div className="space-y-6">
                      <CategoryToggle 
                        label="Executive & Administration"
                        sub="Premier, MECs, DGs, HODs"
                        active={config.provincial.executive.enabled}
                        onToggle={() => setConfig({
                          ...config,
                          provincial: {
                            ...config.provincial,
                            executive: { ...config.provincial.executive, enabled: !config.provincial.executive.enabled }
                          }
                        })}
                        onConfigure={() => setActiveSubModal({ type: 'provincial', category: 'executive' })}
                      />

                      <CategoryToggle 
                        label="Service Delivery"
                        sub="Departmental Programmes"
                        active={config.provincial.delivery.enabled}
                        onToggle={() => setConfig({
                          ...config,
                          provincial: {
                            ...config.provincial,
                            delivery: { ...config.provincial.delivery, enabled: !config.provincial.delivery.enabled }
                          }
                        })}
                        onConfigure={() => setActiveSubModal({ type: 'provincial', category: 'delivery' })}
                      />
                    </div>
                  </div>

                  {/* Local Government */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <MapPin className="w-6 h-6 text-[#004A99]" />
                      <h3 className="text-lg font-bold">Local Government</h3>
                    </div>

                    <div className="space-y-6">
                      <CategoryToggle 
                        label="Executive & Administration"
                        sub="Mayors, Speakers, MMs"
                        active={config.local.executive.enabled}
                        onToggle={() => setConfig({
                          ...config,
                          local: {
                            ...config.local,
                            executive: { ...config.local.executive, enabled: !config.local.executive.enabled }
                          }
                        })}
                        onConfigure={() => setActiveSubModal({ type: 'local', category: 'executive' })}
                      />

                      <CategoryToggle 
                        label="Service Delivery"
                        sub="Municipal Services"
                        active={config.local.delivery.enabled}
                        onToggle={() => setConfig({
                          ...config,
                          local: {
                            ...config.local,
                            delivery: { ...config.local.delivery, enabled: !config.local.delivery.enabled }
                          }
                        })}
                        onConfigure={() => setActiveSubModal({ type: 'local', category: 'delivery' })}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl transition-all ${
                        config.includePoliticalParties ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Flag className="w-6 h-6" />
                      </div>
                      <div className={`w-14 h-7 rounded-full transition-all relative cursor-pointer ${
                        config.includePoliticalParties ? 'bg-orange-500' : 'bg-gray-300'
                      }`} onClick={() => setConfig({ ...config, includePoliticalParties: !config.includePoliticalParties })}>
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                          config.includePoliticalParties ? 'left-8' : 'left-1'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Include Political Party News</p>
                        <p className="text-xs text-gray-500">ANC, DA, EFF, etc. (Governance vs Politics separation)</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      config.includePoliticalParties ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {config.includePoliticalParties ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setShowConfig(false)}
                  className="px-8 py-3 bg-[#004A99] text-white rounded-2xl font-bold text-sm hover:bg-[#003366] transition-all shadow-lg shadow-blue-900/20"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeSubModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-[#004A99] p-2 rounded-xl text-white">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold capitalize">
                      {activeSubModal.category === 'executive' ? 'Executive & Admin' : 'Service Delivery'}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {activeSubModal.type} Government
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveSubModal(null)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(config[activeSubModal.type][activeSubModal.category].subSections).map(([name, isEnabled]) => (
                    <button
                      key={name}
                      onClick={() => setConfig({
                        ...config,
                        [activeSubModal.type]: {
                          ...config[activeSubModal.type],
                          [activeSubModal.category]: {
                            ...config[activeSubModal.type][activeSubModal.category],
                            subSections: {
                              ...config[activeSubModal.type][activeSubModal.category].subSections,
                              [name]: !isEnabled
                            }
                          }
                        }
                      })}
                      className={`px-4 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider border transition-all flex items-center gap-3 ${
                        isEnabled 
                          ? 'bg-[#004A99] border-[#004A99] text-white shadow-lg shadow-blue-900/20' 
                          : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-white' : 'bg-gray-200'}`} />
                      {name}
                    </button>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
                  <button 
                    onClick={() => {
                      const current = config[activeSubModal.type][activeSubModal.category].subSections;
                      const allEnabled = Object.keys(current).reduce((acc, key) => ({ ...acc, [key]: true }), {});
                      setConfig({
                        ...config,
                        [activeSubModal.type]: {
                          ...config[activeSubModal.type],
                          [activeSubModal.category]: {
                            ...config[activeSubModal.type][activeSubModal.category],
                            subSections: allEnabled
                          }
                        }
                      });
                    }}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => {
                      const current = config[activeSubModal.type][activeSubModal.category].subSections;
                      const allDisabled = Object.keys(current).reduce((acc, key) => ({ ...acc, [key]: false }), {});
                      setConfig({
                        ...config,
                        [activeSubModal.type]: {
                          ...config[activeSubModal.type],
                          [activeSubModal.category]: {
                            ...config[activeSubModal.type][activeSubModal.category],
                            subSections: allDisabled
                          }
                        }
                      });
                    }}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => setActiveSubModal(null)}
                  className="w-full py-4 bg-[#004A99] text-white rounded-2xl font-bold text-sm hover:bg-[#003366] transition-all shadow-lg shadow-blue-900/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomDate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-xl">
                    <CalendarDays className="text-[#004A99] w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">Custom Range</h3>
                </div>
                <button onClick={() => setShowCustomDate(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start Date</label>
                  <input 
                    type="date" 
                    value={customDates.start}
                    onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#004A99] font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End Date</label>
                  <input 
                    type="date" 
                    value={customDates.end}
                    onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#004A99] font-medium"
                  />
                </div>

                <button 
                  onClick={handleCustomDateSubmit}
                  disabled={!customDates.start || !customDates.end}
                  className="w-full py-4 bg-[#004A99] text-white rounded-2xl font-bold transition-all hover:bg-[#003366] shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                  Apply & Run Monitor
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Dashboard Header */}
        <div className={`flex flex-col ${orientation === 'landscape' ? 'md:flex-row md:items-end' : ''} justify-between gap-6 mb-8 p-6 bg-white rounded-3xl border border-gray-200 shadow-sm`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className={`${orientation === 'portrait' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-bold tracking-tight truncate`}>Media Intelligence Dashboard</h2>
            </div>
            <p className="text-gray-500 font-medium text-xs sm:text-sm">Real-time monitoring of governance and service delivery in the Eastern Cape.</p>
          </div>
          <div className={`flex items-center ${orientation === 'portrait' ? 'flex-wrap gap-2' : 'gap-3'} shrink-0`}>
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-[9px] sm:text-xs font-bold text-gray-600">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#004A99]" />
              {config.dateRange === 'custom' ? `${customDates.start} to ${customDates.end}` : config.dateRange.toUpperCase()}
            </div>
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-[9px] sm:text-xs font-bold text-gray-600">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              {orientation === 'landscape' ? 'SECURE MONITORING ACTIVE' : 'SECURE'}
            </div>
            {report && (
              <PDFDownloadLink
                document={<MediaIntelligencePDF data={preparePDFData()} dateRange={config.dateRange === 'custom' ? `${customDates.start} to ${customDates.end}` : config.dateRange} />}
                fileName={`EC_Media_Intelligence_Report_${new Date().toISOString().split('T')[0]}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <button 
                    disabled={pdfLoading}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#004A99] text-white rounded-xl flex items-center gap-2 text-[9px] sm:text-xs font-bold hover:bg-[#003d7a] transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {pdfLoading ? 'PREPARING...' : 'EXPORT PDF'}
                  </button>
                )}
              </PDFDownloadLink>
            )}
          </div>
        </div>

        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-white rounded-[32px] border border-blue-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center relative">
                  <RefreshCw className="w-6 h-6 text-[#004A99] animate-spin" />
                  <div className="absolute inset-0 border-2 border-blue-200 border-t-transparent rounded-2xl animate-[spin_3s_linear_infinite]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">
                      {loadingStage <= 2 ? 'Finding Intelligence...' : 'Processing Intelligence...'}
                    </h3>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-[#004A99] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1 h-1 bg-[#004A99] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1 h-1 bg-[#004A99] rounded-full animate-bounce" />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#004A99] font-black uppercase tracking-[0.2em] mt-0.5 animate-pulse">
                    {subProcess || 'Initializing System...'}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Load: 42%</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="h-1.5 w-48 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                  <div 
                    className="h-full bg-gradient-to-r from-[#004A99] to-blue-400 rounded-full transition-all duration-700 ease-out" 
                    style={{ width: `${(loadingStage / stages.length) * 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Granular Progress Stages */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              {stages.map((stage) => {
                const isCompleted = loadingStage > stage.id;
                const isActive = loadingStage === stage.id;
                return (
                  <div 
                    key={stage.id} 
                    className={`p-3.5 rounded-2xl border transition-all duration-500 relative overflow-hidden ${
                      isActive 
                        ? 'bg-white border-[#004A99] shadow-md ring-1 ring-blue-100 scale-[1.02] z-10' 
                        : isCompleted 
                          ? 'bg-emerald-50/50 border-emerald-100' 
                          : 'bg-gray-50/50 border-gray-100 opacity-40'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-blue-50/30 animate-pulse" />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-1.5 rounded-lg ${
                          isActive ? 'bg-[#004A99] text-white' : isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {stage.icon}
                        </div>
                        {isCompleted ? (
                          <div className="bg-emerald-500 rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        ) : isActive ? (
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-[#004A99] animate-ping" />
                          </div>
                        ) : null}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${
                        isActive ? 'text-[#004A99]' : isCompleted ? 'text-emerald-700' : 'text-gray-400'
                      }`}>
                        {stage.name}
                      </span>
                      <p className={`text-[9px] font-bold leading-tight ${
                        isActive ? 'text-blue-700/70' : isCompleted ? 'text-emerald-600/70' : 'text-gray-400'
                      }`}>
                        {stage.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-[#0a0a0a] rounded-3xl p-4 sm:p-6 border border-gray-800 shadow-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Live System Console</span>
                </div>
                <span className="text-[8px] sm:text-[9px] font-mono text-gray-600">v2.1.0-STABLE</span>
              </div>
              <div className="space-y-1 max-h-32 sm:max-h-48 overflow-y-auto pr-2 custom-scrollbar font-mono" ref={logContainerRef}>
                {activityLog.map((log, idx) => (
                  <div key={idx} className={`text-[9px] sm:text-[10px] leading-relaxed break-all ${idx === activityLog.length - 1 ? 'text-green-400' : 'text-gray-500'}`}>
                    {idx === activityLog.length - 1 ? '> ' : '  '}{log}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {report && (
          <div className="space-y-8">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                title="Total Scanned" 
                value={report.summary.total_articles_scanned} 
                icon={<Newspaper className="w-5 h-5" />}
                color="blue"
              />
              <StatCard 
                title="Articles Discovered" 
                value={report.articles.length} 
                icon={<CheckCircle className="w-5 h-5" />}
                color="green"
              />
              <StatCard 
                title="High Risk" 
                value={report.summary.high_risk + report.summary.critical_risk} 
                icon={<AlertTriangle className="w-5 h-5" />}
                color="red"
              />
              <StatCard 
                title="Response Needed" 
                value={report.summary.response_needed} 
                icon={<Clock className="w-5 h-5" />}
                color="orange"
              />
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    Risk Distribution
                  </h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Critical', count: report.summary.critical_risk, color: '#ef4444' },
                      { name: 'High', count: report.summary.high_risk, color: '#f97316' },
                      { name: 'Moderate', count: report.articles.filter(a => a.reputational_risk === 'Moderate').length, color: '#f59e0b' },
                      { name: 'Low', count: report.articles.filter(a => a.reputational_risk === 'Low').length, color: '#3b82f6' },
                      { name: 'None', count: report.articles.filter(a => a.reputational_risk === 'None').length, color: '#10b981' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f9fafb' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {[
                          { name: 'Critical', color: '#ef4444' },
                          { name: 'High', color: '#f97316' },
                          { name: 'Moderate', color: '#f59e0b' },
                          { name: 'Low', color: '#3b82f6' },
                          { name: 'None', color: '#10b981' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-emerald-600" />
                    Tone Classification
                  </h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Positive', value: report.summary.positive, color: '#10b981' },
                          { name: 'Negative', value: report.summary.negative, color: '#ef4444' },
                          { name: 'Mixed', value: report.summary.mixed, color: '#f97316' },
                          { name: 'Neutral', value: report.summary.neutral, color: '#3b82f6' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Positive', color: '#10b981' },
                          { name: 'Negative', color: '#ef4444' },
                          { name: 'Mixed', color: '#f97316' },
                          { name: 'Neutral', color: '#3b82f6' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {[
                    { name: 'Positive', color: 'bg-emerald-500' },
                    { name: 'Negative', color: 'bg-red-500' },
                    { name: 'Mixed', color: 'bg-orange-500' },
                    { name: 'Neutral', color: 'bg-blue-500' },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sentiment Trend Chart */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Sentiment Trend
                </h3>
                <div className="flex gap-4">
                  {[
                    { name: 'Positive', color: '#10b981' },
                    { name: 'Neutral', color: '#3b82f6' },
                    { name: 'Negative', color: '#ef4444' },
                    { name: 'Mixed', color: '#f97316' },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(() => {
                    const dataMap: { [key: string]: any } = {};
                    report.articles.forEach(article => {
                      const dateObj = new Date(article.publication_date);
                      if (isNaN(dateObj.getTime())) return;
                      const dateStr = dateObj.toISOString().split('T')[0];
                      if (!dataMap[dateStr]) {
                        dataMap[dateStr] = { date: dateStr, Positive: 0, Neutral: 0, Negative: 0, Mixed: 0 };
                      }
                      const tone = article.tone_classification;
                      if (tone in dataMap[dateStr]) {
                        dataMap[dateStr][tone]++;
                      }
                    });
                    return Object.values(dataMap)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map(item => ({
                        ...item,
                        displayDate: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }));
                  })()}>
                    <defs>
                      <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="displayDate" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600 }} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="Positive" stroke="#10b981" fillOpacity={1} fill="url(#colorPos)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Neutral" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" dataKey="Mixed" stroke="#f97316" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" dataKey="Negative" stroke="#ef4444" fillOpacity={1} fill="url(#colorNeg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Entities Section */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#004A99]" />
                  Top Entities Mentioned
                </h3>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Entity Frequency</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {topEntities.map(([entity, count], i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl hover:bg-blue-50 hover:border-blue-100 transition-all group cursor-default"
                  >
                    <span className="text-xs font-bold text-gray-700 group-hover:text-[#004A99]">{entity}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-gray-400 group-hover:text-[#004A99] group-hover:border-blue-200">
                      {count}
                    </span>
                  </div>
                ))}
                {topEntities.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No entities identified in this report.</p>
                )}
              </div>
            </div>

            {/* Sentiment Breakdown Section */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-emerald-600" />
                  Sentiment Breakdown
                </h3>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Overall Sentiment</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Positive', value: report.summary.positive, color: '#10b981' },
                          { name: 'Negative', value: report.summary.negative, color: '#ef4444' },
                          { name: 'Mixed', value: report.summary.mixed, color: '#f97316' },
                          { name: 'Neutral', value: report.summary.neutral, color: '#3b82f6' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Positive', color: '#10b981' },
                          { name: 'Negative', color: '#ef4444' },
                          { name: 'Mixed', color: '#f97316' },
                          { name: 'Neutral', color: '#3b82f6' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Positive', count: report.summary.positive, color: 'bg-emerald-500', text: 'text-emerald-700' },
                    { name: 'Neutral', count: report.summary.neutral, color: 'bg-blue-500', text: 'text-blue-700' },
                    { name: 'Negative', count: report.summary.negative, color: 'bg-red-500', text: 'text-red-700' },
                    { name: 'Mixed', count: report.summary.mixed, color: 'bg-orange-500', text: 'text-orange-700' },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm font-bold text-gray-700">{item.name}</span>
                      </div>
                      <span className={`text-sm font-black ${item.text}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Source Verification Checklist */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-bold">Source Verification Checklist</h3>
                </div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Checks & Balances</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.verification_checklist?.map((check, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold truncate pr-2">{check.domain}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        check.status === 'Checked - Articles Found' ? 'bg-green-100 text-green-700' :
                        check.status === 'Checked - No Relevant Articles' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {check.status.replace('Checked - ', '')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{check.findings_summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`grid grid-cols-1 ${orientation === 'landscape' ? 'lg:grid-cols-3' : ''} gap-8`}>
              {/* Article List */}
              <div className={`${orientation === 'landscape' ? 'lg:col-span-2' : ''} space-y-6`}>
                <div className={`flex flex-col ${orientation === 'landscape' ? 'sm:flex-row sm:items-center' : ''} justify-between gap-4 mb-4`}>
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-[#004A99]" />
                      Latest Coverage
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {report.articles.length} articles in {Object.keys(groupArticles(report.articles)).length} clusters
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sort:</span>
                    <select 
                      value={sort.field}
                      onChange={(e) => setSort({ ...sort, field: e.target.value as any })}
                      className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-[#004A99] outline-none"
                    >
                      <option value="date">Date</option>
                      <option value="risk">Risk</option>
                    </select>
                    <button 
                      onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                      className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      title={sort.direction === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                    >
                      {sort.direction === 'asc' ? <ChevronDown className="w-4 h-4 rotate-180" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Search and Filters Section */}
                <div className="space-y-4 mb-6">
                  {/* Search Bar */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#004A99]">
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search articles by title, source, entity, or tags..."
                      className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#004A99] focus:border-transparent transition-all shadow-sm font-medium text-sm"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#004A99]" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filters</span>
                  </div>
                  
                  {/* Sphere Filter */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sphere</span>
                    <div className="flex gap-1.5">
                      {['Provincial', 'Local'].map(sphere => (
                        <button
                          key={sphere}
                          onClick={() => setFilterSpheres(prev => prev.includes(sphere) ? prev.filter(s => s !== sphere) : [...prev, sphere])}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            filterSpheres.includes(sphere)
                              ? 'bg-[#004A99] border-[#004A99] text-white shadow-sm'
                              : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {sphere}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Risk Filter */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Risk</span>
                    <div className="flex gap-1.5">
                      {['Critical', 'High', 'Moderate', 'Low', 'None'].map(risk => (
                        <button
                          key={risk}
                          onClick={() => setFilterRisks(prev => prev.includes(risk) ? prev.filter(r => r !== risk) : [...prev, risk])}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            filterRisks.includes(risk)
                              ? 'bg-[#004A99] border-[#004A99] text-white shadow-sm'
                              : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {risk}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags Filter */}
                  {report && Array.from(new Set(report.articles.flatMap(a => a.user_tags || []))).length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tags</span>
                      <div className="flex gap-1.5">
                        {Array.from(new Set(report.articles.flatMap(a => a.user_tags || []))).map(tag => (
                          <button
                            key={tag}
                            onClick={() => setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                              filterTags.includes(tag)
                                ? 'bg-[#004A99] border-[#004A99] text-white shadow-sm'
                                : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(filterTags.length > 0 || filterSpheres.length > 0 || filterRisks.length > 0 || searchTerm) && (
                    <button 
                      onClick={() => {
                        setFilterTags([]);
                        setFilterSpheres([]);
                        setFilterRisks([]);
                        setSearchTerm('');
                      }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 ml-auto flex items-center gap-1.5 px-2 py-1 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X className="w-3 h-3" />
                      CLEAR ALL
                    </button>
                  )}
                </div>
              </div>
              
              {Object.keys(groupArticles(report.articles)).length === 0 ? (
                  <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center">
                    <Info className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-sm text-gray-400">No articles found matching your current search or filters.</p>
                    {(filterTags.length > 0 || filterSpheres.length > 0 || filterRisks.length > 0 || searchTerm) && (
                      <button 
                        onClick={() => {
                          setFilterTags([]);
                          setFilterSpheres([]);
                          setFilterRisks([]);
                          setSearchTerm('');
                        }}
                        className="mt-4 px-6 py-2 bg-[#004A99] text-white rounded-xl text-xs font-bold hover:bg-[#003366] transition-colors"
                      >
                        Clear All Filters & Search
                      </button>
                    )}
                  </div>
                ) : (
                  Object.entries(groupArticles(report.articles)).map(([clusterId, articles], idx) => (
                    <ArticleCluster 
                      key={clusterId} 
                      articles={articles} 
                      index={idx}
                      selectedArticle={selectedArticle}
                      onSelect={(article) => {
                        setSelectedArticle(article);
                        setShowMobileDetail(true);
                      }}
                      onUpdateTags={handleUpdateArticleTags}
                      onGenerateSummary={handleGenerateSummary}
                    />
                  ))
                )}
              </div>

              {/* Detail Panel - Desktop (Landscape) */}
              <div className={`${orientation === 'landscape' ? 'block lg:col-span-1' : 'hidden'}`}>
                <div className="sticky top-24">
                  <AnimatePresence mode="wait">
                    {selectedArticle ? (
                      <ArticleDetailView 
                        article={selectedArticle} 
                        onClose={() => setSelectedArticle(null)} 
                        onUpdateTags={handleUpdateArticleTags}
                        onTagClick={handleTagClick}
                        onGenerateSummary={handleGenerateSummary}
                      />
                    ) : (
                      <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center">
                        <Info className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-sm text-gray-400">Select an article to view detailed intelligence and risk assessment.</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showCompletionPopup && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-8 right-8 z-[100] bg-white rounded-2xl shadow-2xl border border-blue-100 p-6 max-w-sm"
            >
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">Scan Complete</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    The media intelligence scan has finished processing. Found {report?.articles.length || 0} relevant articles.
                  </p>
                  <button
                    onClick={() => setShowCompletionPopup(false)}
                    className="w-full py-2 bg-[#004A99] text-white rounded-xl text-sm font-bold hover:bg-[#003366] transition-colors"
                  >
                    View Results
                  </button>
                </div>
                <button 
                  onClick={() => setShowCompletionPopup(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Panel - Mobile (Portrait) */}
      <AnimatePresence>
        {showMobileDetail && selectedArticle && orientation === 'portrait' && (
          <div className="fixed inset-0 z-[100]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileDetail(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mt-4 mb-2 shrink-0" />
              <div className="flex-1 overflow-y-auto">
                <ArticleDetailView 
                  article={selectedArticle} 
                  onClose={() => setShowMobileDetail(false)} 
                  onUpdateTags={handleUpdateArticleTags}
                  onTagClick={handleTagClick}
                  onGenerateSummary={handleGenerateSummary}
                  isMobile
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArticleDetailView({ article, onClose, onUpdateTags, onTagClick, onGenerateSummary, isMobile }: { 
  article: Article, 
  onClose: () => void, 
  onUpdateTags: (url: string, tags: string[]) => void, 
  onTagClick?: (tag: string) => void,
  onGenerateSummary: (url: string) => Promise<void>,
  isMobile?: boolean 
}) {
  const [newTag, setNewTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const currentTags = article.user_tags || [];
    if (!currentTags.includes(newTag.trim())) {
      onUpdateTags(article.article_url, [...currentTags, newTag.trim()]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    const currentTags = article.user_tags || [];
    onUpdateTags(article.article_url, currentTags.filter(t => t !== tag));
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'Critical': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ShieldAlert className="w-4 h-4" />,
        dot: 'bg-red-500'
      };
      case 'High': return { 
        color: 'text-orange-700 bg-orange-50 border-orange-200', 
        icon: <AlertTriangle className="w-4 h-4" />,
        dot: 'bg-orange-500'
      };
      case 'Moderate': return { 
        color: 'text-amber-700 bg-amber-50 border-amber-200', 
        icon: <Zap className="w-4 h-4" />,
        dot: 'bg-amber-500'
      };
      case 'Low': return { 
        color: 'text-blue-700 bg-blue-50 border-blue-200', 
        icon: <Info className="w-4 h-4" />,
        dot: 'bg-blue-500'
      };
      default: return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ShieldCheck className="w-4 h-4" />,
        dot: 'bg-emerald-500'
      };
    }
  };

  const getToneBadge = (tone: string) => {
    switch (tone) {
      case 'Positive': return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ThumbsUp className="w-4 h-4" />,
        dot: 'bg-emerald-500'
      };
      case 'Negative': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ThumbsDown className="w-4 h-4" />,
        dot: 'bg-red-500'
      };
      case 'Mixed': return { 
        color: 'text-orange-700 bg-orange-50 border-orange-200', 
        icon: <RefreshCw className="w-4 h-4" />,
        dot: 'bg-orange-500'
      };
      case 'Neutral': return { 
        color: 'text-blue-700 bg-blue-50 border-blue-200', 
        icon: <Minus className="w-4 h-4" />,
        dot: 'bg-blue-500'
      };
      default: return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-4 h-4" />,
        dot: 'bg-gray-500'
      };
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'Verified': return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ShieldCheck className="w-4 h-4" />,
        dot: 'bg-emerald-500'
      };
      case 'Potentially Hallucinated': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ShieldAlert className="w-4 h-4" />,
        dot: 'bg-red-500'
      };
      case 'Unverified': return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-4 h-4" />,
        dot: 'bg-gray-500'
      };
      default: return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-4 h-4" />,
        dot: 'bg-gray-500'
      };
    }
  };

  const riskBadge = getRiskBadge(article.reputational_risk);
  const toneBadge = getToneBadge(article.tone_classification);
  const verificationBadge = getVerificationBadge(article.url_verification_status);

  return (
    <motion.div 
      key={article.article_url}
      initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isMobile ? 0 : 20 }}
      className={`bg-white ${isMobile ? '' : 'rounded-3xl border border-gray-200 shadow-sm'} overflow-hidden`}
    >
      <div className="p-6 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${verificationBadge.color}`}>
              {verificationBadge.icon}
              {article.url_verification_status}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${riskBadge.color}`}>
              {riskBadge.icon}
              {article.reputational_risk} Risk
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${toneBadge.color}`}>
              {toneBadge.icon}
              {article.tone_classification} Tone
            </span>
          </div>
          {isMobile && (
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        <h3 className="text-xl font-bold mb-4 leading-tight">{article.article_title}</h3>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <Newspaper className="w-3.5 h-3.5 text-[#004A99]" />
            {article.source_name}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            {article.publication_date}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5" />
            {article.municipality_or_district || 'Provincial'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {article.topic_categories.map((cat, i) => (
            <span key={i} className="text-[10px] font-bold uppercase px-2 py-1 bg-white border border-gray-200 rounded-md text-gray-600">
              {cat}
            </span>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
          <h5 className="text-[10px] font-black text-[#004A99] uppercase tracking-widest mb-1">Quick Summary</h5>
          <p className="text-sm font-medium text-gray-800 leading-relaxed italic">
            "{article.summary_1_sentence}"
          </p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Grounding Verification</h5>
          <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
            {article.grounding_source || "Verified via Google Search grounding."}
          </p>
        </div>

        <div>
          <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <Tag className="w-3 h-3" />
            Manual Tags
          </h5>
          <div className="flex flex-wrap gap-2 mb-3">
            {article.user_tags?.map((tag, i) => (
              <AppTooltip key={i} content="Click to filter by this tag, or 'x' to remove.">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase border rounded-md overflow-hidden">
                  <button
                    onClick={() => onTagClick?.(tag)}
                    className="px-2 py-1 bg-blue-50 text-[#004A99] border-r border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    {tag}
                  </button>
                  <button 
                    onClick={() => handleRemoveTag(tag)} 
                    className="px-1.5 py-1 bg-blue-50 text-[#004A99] hover:bg-red-50 hover:text-red-500 transition-colors"
                    title={`Remove tag "${tag}"`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              </AppTooltip>
            ))}
            {(!article.user_tags || article.user_tags.length === 0) && (
              <p className="text-[10px] text-gray-400 italic">No manual tags added yet.</p>
            )}
          </div>
          <form onSubmit={handleAddTag} className="flex gap-2">
            <label htmlFor="article-tag-input" className="sr-only">Add custom label</label>
            <input 
              id="article-tag-input"
              type="text" 
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add custom label..."
              className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#004A99]"
            />
            <button 
              type="submit"
              className="p-1.5 bg-[#004A99] text-white rounded-lg hover:bg-[#003366] transition-colors"
              title="Add Tag"
            >
              <Plus className="w-4 h-4" />
            </button>
            {!article.summary_1_sentence && (
              <button 
                type="button"
                onClick={async () => {
                  setIsGenerating(true);
                  await onGenerateSummary(article.article_url);
                  setIsGenerating(false);
                }}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-all disabled:opacity-50"
                title="Generate Concise Summary"
              >
                {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                GENERATE
              </button>
            )}
          </form>
        </div>

        <div>
          <h5 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
            <Newspaper className="w-3 h-3" />
            Full Executive Summary
          </h5>
          <p className="text-sm text-gray-700 leading-relaxed">{article.summary_1_paragraph}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-xl border ${toneBadge.color}`}>
            <div className="flex items-center gap-2 mb-1">
              {toneBadge.icon}
              <h5 className="text-[10px] font-bold uppercase opacity-70">Tone Analysis</h5>
            </div>
            <p className="text-sm font-bold">
              {article.tone_classification}
            </p>
            <p className="text-[10px] opacity-80 mt-1">{article.tone_reason}</p>
          </div>
          <div className={`p-3 rounded-xl border ${riskBadge.color}`}>
            <div className="flex items-center gap-2 mb-1">
              {riskBadge.icon}
              <h5 className="text-[10px] font-bold uppercase opacity-70">Risk Level</h5>
            </div>
            <p className="text-sm font-bold">
              {article.reputational_risk}
            </p>
            <p className="text-[10px] opacity-80 mt-1">{article.risk_reason}</p>
          </div>
        </div>

        <div>
          <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500" />
            Strategic Recommendation
          </h5>
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 mb-1 uppercase tracking-tight">
                  {article.recommended_action}
                </p>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  {article.action_reason}
                </p>
              </div>
            </div>
          </div>
        </div>

        <a 
          href={article.article_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors"
        >
          View Original Source
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  );
}

interface ArticleClusterProps {
  articles: Article[];
  index: number;
  selectedArticle: Article | null;
  onSelect: (a: Article) => void;
  onUpdateTags: (url: string, tags: string[]) => void;
  onGenerateSummary: (url: string) => Promise<void>;
}

const ArticleCluster: React.FC<ArticleClusterProps> = ({ articles, index, selectedArticle, onSelect, onUpdateTags, onGenerateSummary }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSyndicated, setShowSyndicated] = useState(false);
  const currentArticle = articles[currentIndex];
  const isSelected = selectedArticle && articles.some(a => a.article_url === selectedArticle.article_url);

  const selectArticle = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(idx);
    onSelect(articles[idx]);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % articles.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
  };

  useEffect(() => {
    if (isSelected && selectedArticle) {
      const idx = articles.findIndex(a => a.article_url === selectedArticle.article_url);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [isSelected, selectedArticle, articles]);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'Critical': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ShieldAlert className="w-3 h-3" />,
        dot: 'bg-red-500'
      };
      case 'High': return { 
        color: 'text-orange-700 bg-orange-50 border-orange-200', 
        icon: <AlertTriangle className="w-3 h-3" />,
        dot: 'bg-orange-500'
      };
      case 'Moderate': return { 
        color: 'text-amber-700 bg-amber-50 border-amber-200', 
        icon: <Zap className="w-3 h-3" />,
        dot: 'bg-amber-500'
      };
      case 'Low': return { 
        color: 'text-blue-700 bg-blue-50 border-blue-200', 
        icon: <Info className="w-3 h-3" />,
        dot: 'bg-blue-500'
      };
      default: return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ShieldCheck className="w-3 h-3" />,
        dot: 'bg-emerald-500'
      };
    }
  };

  const getToneBadge = (tone: string) => {
    switch (tone) {
      case 'Positive': return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ThumbsUp className="w-3 h-3" />,
        dot: 'bg-emerald-500'
      };
      case 'Negative': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ThumbsDown className="w-3 h-3" />,
        dot: 'bg-red-500'
      };
      case 'Mixed': return { 
        color: 'text-orange-700 bg-orange-50 border-orange-200', 
        icon: <RefreshCw className="w-3 h-3" />,
        dot: 'bg-orange-500'
      };
      case 'Neutral': return { 
        color: 'text-blue-700 bg-blue-50 border-blue-200', 
        icon: <Minus className="w-3 h-3" />,
        dot: 'bg-blue-500'
      };
      default: return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-3 h-3" />,
        dot: 'bg-gray-500'
      };
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'Verified': return { 
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200', 
        icon: <ShieldCheck className="w-3 h-3" />,
        dot: 'bg-emerald-500'
      };
      case 'Potentially Hallucinated': return { 
        color: 'text-red-700 bg-red-50 border-red-200', 
        icon: <ShieldAlert className="w-3 h-3" />,
        dot: 'bg-red-500'
      };
      case 'Unverified': return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-3 h-3" />,
        dot: 'bg-gray-500'
      };
      default: return { 
        color: 'text-gray-700 bg-gray-50 border-gray-200', 
        icon: <Info className="w-3 h-3" />,
        dot: 'bg-gray-500'
      };
    }
  };

  const riskBadge = getRiskBadge(currentArticle.reputational_risk);
  const toneBadge = getToneBadge(currentArticle.tone_classification);
  const verificationBadge = getVerificationBadge(currentArticle.url_verification_status);

  return (
    <div className="relative group">
      {/* Visual Stack Effect for syndicated articles - Refined for subtlety */}
      {articles.length > 1 && (
        <>
          <div className="absolute inset-x-1.5 -bottom-1 h-full bg-gray-50/80 border border-gray-100 rounded-3xl -z-10 transition-all duration-500 group-hover:-bottom-1.5 group-hover:bg-gray-100/50" />
          <div className="absolute inset-x-3 -bottom-2 h-full bg-gray-50/40 border border-gray-50 rounded-3xl -z-20 transition-all duration-700 group-hover:-bottom-3 group-hover:bg-gray-50/60" />
        </>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => onSelect(currentArticle)}
        className={`relative p-4 sm:p-6 bg-white rounded-3xl border transition-all cursor-pointer hover:shadow-xl ${
          isSelected 
            ? 'border-[#004A99] ring-2 ring-blue-50 shadow-lg' 
            : currentIndex === 0 && articles.length > 1
              ? 'border-blue-100 bg-gradient-to-br from-white to-blue-50/20'
              : 'border-gray-200'
        }`}
      >
        {articles.length > 1 && (
          <div className="absolute -top-3 left-6 px-3 py-1 bg-[#004A99] text-white text-[10px] font-bold rounded-full flex items-center gap-1.5 shadow-lg z-10">
            <Layers className="w-3 h-3" />
            {articles.length} SOURCES SYNDICATED
          </div>
        )}

        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <AppTooltip content={currentIndex === 0 ? "This is the primary source for this intelligence cluster." : "This is a syndicated version of the primary report."}>
              <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 shadow-sm transition-all ${
                currentIndex === 0 
                  ? 'bg-[#004A99] text-white border border-[#004A99]' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {currentIndex === 0 ? <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <Newspaper className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                {currentIndex === 0 ? 'Primary Intelligence' : 'Syndicated Report'}
              </div>
            </AppTooltip>

            <AppTooltip content="The media outlet that originally published this article.">
              <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 bg-white rounded-full text-gray-400 border border-gray-100 shadow-sm">
                {currentArticle.source_name}
              </span>
            </AppTooltip>

            <AppTooltip content="The date the primary intelligence report was first published.">
              <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 bg-white rounded-full text-gray-400 border border-gray-100 shadow-sm flex items-center gap-1 sm:gap-1.5">
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#004A99]" />
                {articles[0].publication_date}
              </span>
            </AppTooltip>

            <AppTooltip content="The specific geographic area or administrative district mentioned in the report.">
              <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 bg-white rounded-full text-gray-400 border border-gray-100 shadow-sm flex items-center gap-1 sm:gap-1.5">
                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#004A99]" />
                {currentArticle.municipality_or_district || 'Provincial'}
              </span>
            </AppTooltip>

            <AppTooltip content="The potential impact this story has on the reputation of the Eastern Cape Government.">
              <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 rounded-full border shadow-sm flex items-center gap-1 sm:gap-1.5 ${riskBadge.color}`}>
                {riskBadge.icon}
                {currentArticle.reputational_risk}
              </span>
            </AppTooltip>

            {currentArticle.user_tags?.map((tag, i) => (
              <AppTooltip key={i} content="Manual tag added by user.">
                <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:py-1 bg-blue-50 text-[#004A99] border border-blue-100 rounded-full shadow-sm flex items-center gap-1 sm:gap-1.5">
                  <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {tag}
                </span>
              </AppTooltip>
            ))}
          </div>
        </div>

        <h4 className={`font-bold text-base sm:text-lg mb-2 leading-tight transition-colors ${currentIndex === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
          {currentArticle.article_title}
        </h4>
        
        <div className="relative mb-4">
          {!currentArticle.summary_1_sentence ? (
            <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl flex items-center justify-between">
              <p className="text-[10px] text-gray-400 italic">No concise summary available.</p>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsGenerating(true);
                  await onGenerateSummary(currentArticle.article_url);
                  setIsGenerating(false);
                }}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#004A99] text-white rounded-lg text-[10px] font-bold hover:bg-[#003366] transition-all disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                GENERATE SUMMARY
              </button>
            </div>
          ) : (
            <>
              <p className={`text-sm text-gray-600 leading-relaxed italic transition-all duration-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                "{isExpanded ? currentArticle.summary_1_paragraph : currentArticle.summary_1_sentence}"
              </p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-[10px] font-bold text-[#004A99] hover:text-[#003366] mt-2 flex items-center gap-1 transition-colors"
              >
                {isExpanded ? (
                  <>SHOW LESS <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>READ MORE <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            </>
          )}
        </div>
        
        {/* Syndication Navigation & List */}
        {articles.length > 1 && (
          <div className="mb-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowSyndicated(!showSyndicated);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                showSyndicated 
                  ? 'bg-[#004A99] text-white border-[#004A99] shadow-md' 
                  : 'bg-gray-50 text-[#004A99] border-gray-100 hover:bg-gray-100'
              }`}
            >
              <Layers className="w-3 h-3" />
              {showSyndicated ? 'Hide Syndicated Versions' : `View ${articles.length - 1} Syndicated Versions`}
              {showSyndicated ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>

            <AnimatePresence>
              {showSyndicated && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#004A99] animate-pulse" />
                        <span className="text-[10px] font-black text-[#004A99] uppercase tracking-widest">Syndication Network</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={prev} className="p-1.5 bg-white border border-gray-200 hover:border-[#004A99] rounded-lg text-gray-400 hover:text-[#004A99] transition-all shadow-sm">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-black text-gray-600 min-w-[45px] text-center bg-white border border-gray-200 py-1 rounded-lg shadow-sm">
                          {currentIndex + 1} <span className="text-gray-300 mx-0.5">/</span> {articles.length}
                        </span>
                        <button onClick={next} className="p-1.5 bg-white border border-gray-200 hover:border-[#004A99] rounded-lg text-gray-400 hover:text-[#004A99] transition-all shadow-sm">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {articles.map((art, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => selectArticle(idx, e)}
                          className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold transition-all border flex flex-col items-start gap-1 ${
                            currentIndex === idx 
                              ? 'bg-[#004A99] border-[#004A99] text-white shadow-md scale-105' 
                              : 'bg-white border-gray-200 text-gray-500 hover:border-[#004A99] hover:text-[#004A99] shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {idx === 0 && <ShieldCheck className="w-3 h-3" />}
                            {art.source_name}
                          </div>
                          <div className={`text-[9px] opacity-70 flex items-center gap-1 ${currentIndex === idx ? 'text-blue-100' : 'text-gray-400'}`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {art.publication_date}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${toneBadge.color} bg-transparent border-none p-0`}>
              {toneBadge.icon}
              {currentArticle.tone_classification} Tone
            </div>
          </div>
          <div className="flex items-center gap-1 text-[#004A99] font-bold text-[11px] uppercase tracking-wider">
            Intelligence Report
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};


function CategoryToggle({ label, sub, active, onToggle, onConfigure }: { 
  label: string, 
  sub: string, 
  active: boolean, 
  onToggle: () => void,
  onConfigure: () => void
}) {
  return (
    <div className={`rounded-3xl border transition-all overflow-hidden ${
      active ? 'bg-white border-[#004A99] shadow-sm' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={onToggle}>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            active ? 'bg-[#004A99] border-[#004A99]' : 'border-gray-300'
          }`}>
            {active && <CheckCircle className="w-3.5 h-3.5 text-white" />}
          </div>
          <div>
            <p className={`text-sm font-bold ${active ? 'text-[#004A99]' : 'text-gray-700'}`}>{label}</p>
            <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
          </div>
        </div>
        {active && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-2 text-[10px] font-bold text-gray-600"
          >
            <Filter className="w-3 h-3" />
            Filter
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: 'blue' | 'green' | 'red' | 'orange' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`p-2 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">{value}</span>
      </div>
      <h4 className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">{title}</h4>
    </div>
  );
}

const AppTooltip: React.FC<{ children: React.ReactNode, content: string }> = ({ children, content }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1A1A1A] text-white text-[10px] rounded-xl shadow-2xl z-50 pointer-events-none min-w-[140px] text-center border border-gray-800"
          >
            <div className="relative z-10 font-bold leading-tight">{content}</div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1A1A1A] rotate-45 border-r border-b border-gray-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
