import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { wsService } from '../services/websocket';
import { Project, Phase, PhaseType, Comment, WebSocketEvent } from '../types';

const PHASES: { type: PhaseType; label: string; description: string }[] = [
  { type: 'idea', label: '1. アイデア', description: '自由形式での発想整理' },
  { type: 'requirements', label: '2. 要件定義', description: '構造化された要件入力' },
  { type: 'design_planning', label: '3. 設計計画', description: '技術方針・構成案' },
  { type: 'design_document', label: '4. 設計書作成', description: '最終設計書の生成' },
];

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('idea');
  const [phaseData, setPhaseData] = useState<Phase | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [aiLoading, setAiLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, any>>({});
  const editorRef = React.useRef<any>(null);
  const decorationsRef = React.useRef<string[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      
      // Connect to WebSocket
      // In a real app, we'd get the token from auth state
      const token = localStorage.getItem('token') || 'guest-token';
      wsService.connect(projectId, token);

      // Listen for events
      wsService.on('edit', handleRemoteEdit);
      wsService.on('presence', handlePresenceUpdate);
      wsService.on('comment', handleRemoteComment);
      wsService.on('cursor', handleRemoteCursor);

      return () => {
        wsService.off('edit', handleRemoteEdit);
        wsService.off('presence', handlePresenceUpdate);
        wsService.off('comment', handleRemoteComment);
        wsService.off('cursor', handleRemoteCursor);
        wsService.disconnect();
      };
    }
  }, [projectId]);

  const handleRemoteCursor = (event: WebSocketEvent) => {
    if (event.user.id !== 'guest-user') {
      setRemoteCursors(prev => ({
        ...prev,
        [event.user.id]: {
          name: event.user.name,
          position: event.data.position
        }
      }));
    }
  };

  useEffect(() => {
    if (editorRef.current && Object.keys(remoteCursors).length > 0) {
      const newDecorations: any[] = [];
      
      Object.entries(remoteCursors).forEach(([userId, data]: [string, any]) => {
        newDecorations.push({
          range: {
            startLineNumber: data.position.lineNumber,
            startColumn: data.position.column,
            endLineNumber: data.position.lineNumber,
            endColumn: data.position.column + 1
          },
          options: {
            className: `remote-cursor-${userId}`,
            hoverMessage: { value: data.name },
            beforeContentClassName: `remote-cursor-label-${userId}`
          }
        });
      });

      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        newDecorations
      );
    }
  }, [remoteCursors]);

  const handleRemoteEdit = (event: WebSocketEvent) => {
    if (event.user.id !== 'guest-user') { // Avoid self-updates if possible
      setContent(event.data.content);
    }
  };

  const handlePresenceUpdate = (event: WebSocketEvent) => {
    if (event.data.status === 'connected') {
      setOnlineUsers(prev => {
        if (prev.find(u => u.id === event.user.id)) return prev;
        return [...prev, event.user];
      });
    } else if (event.data.status === 'disconnected') {
      setOnlineUsers(prev => prev.filter(u => u.id !== event.user.id));
    }
  };

  const handleRemoteComment = (event: WebSocketEvent) => {
    fetchComments();
  };

  useEffect(() => {
    if (projectId && currentPhase) {
      fetchPhase();
      fetchComments();
      fetchHistory();
    }
  }, [projectId, currentPhase]);

  const fetchHistory = async () => {
    try {
      const data = await api.getHistory(projectId!, currentPhase);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleRollback = async (historyId: string) => {
    if (!window.confirm('このバージョンにロールバックしますか？現在の内容は失われます。')) return;
    try {
      const data = await api.rollback(projectId!, historyId);
      setPhaseData(data);
      setContent(typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2));
      setShowHistory(false);
      alert('ロールバックしました。');
    } catch (error) {
      console.error('Rollback failed:', error);
      alert('ロールバックに失敗しました。');
    }
  };

  const fetchComments = async () => {
    try {
      const data = await api.getComments(projectId!, currentPhase);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.addComment(projectId!, currentPhase, newComment);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('コメントの追加に失敗しました。');
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await api.resolveComment(projectId!, commentId);
      fetchComments();
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (loading || !phaseData) return;

    const timer = setTimeout(() => {
      if (content !== (typeof phaseData.data === 'string' ? phaseData.data : JSON.stringify(phaseData.data, null, 2))) {
        handleSave(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content]);

  const fetchProject = async () => {
    try {
      const data = await api.getProject(projectId!);
      setProject(data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      navigate('/');
    }
  };

  const fetchPhase = async () => {
    try {
      setLoading(true);
      const data = await api.getPhase(projectId!, currentPhase);
      setPhaseData(data);
      
      let initialContent = '';
      if (data.data && Object.keys(data.data).length > 0) {
        initialContent = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
      } else {
        // Default templates for each phase
        const templates: Record<PhaseType, string> = {
          'idea': '# プロジェクトのアイデア\n\nここにプロジェクトの概要や解決したい課題を自由に記述してください。',
          'requirements': '# 要件定義書\n\n## 1. 機能要件\n- \n\n## 2. 非機能要件\n- ',
          'design_planning': '# 設計計画\n\n## 1. 技術スタック\n- \n\n## 2. システム構成\n- ',
          'design_document': '# 詳細設計書\n\n## 1. API定義\n- \n\n## 2. データベース設計\n- '
        };
        initialContent = templates[currentPhase] || '';
      }
      setContent(initialContent);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to fetch phase:', error);
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    
    // Broadcast change via WebSocket
    wsService.send({
      action: 'edit',
      data: { content: newContent, phase_type: currentPhase }
    });
  };

  const handleCursorChange = (e: any) => {
    wsService.send({
      action: 'cursor',
      data: {
        position: e.position,
        phase_type: currentPhase
      }
    });
  };

  const handleSave = async (isAutoSave = false) => {
    try {
      setSaving(true);
      setSaveStatus('saving');
      let dataToSave: any = content;
      
      // If it's valid JSON, save as object, otherwise save as string
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          dataToSave = JSON.parse(content);
        } catch (e) {
          // Keep as string
        }
      }
      
      await api.updatePhase(projectId!, currentPhase, dataToSave);
      setSaveStatus('saved');
      if (!isAutoSave) alert('保存しました！');
    } catch (error) {
      console.error('Failed to save phase:', error);
      setSaveStatus('error');
      if (!isAutoSave) alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleAiAssist = async (action: string) => {
    try {
      setAiLoading(true);
      const result = await api.requestAIAssist(projectId!, {
        phase_type: currentPhase,
        action,
        input: { current_content: content }
      });
      
      if (result.output && result.output.suggested_content) {
        const newContent = typeof result.output.suggested_content === 'string' 
          ? result.output.suggested_content 
          : JSON.stringify(result.output.suggested_content, null, 2);
        
        if (window.confirm('AIの提案を採用しますか？現在の内容は上書きされます。')) {
          setContent(newContent);
        }
      } else if (result.output && result.output.summary) {
        alert('AIの分析結果:\n\n' + result.output.summary);
      }
    } catch (error) {
      console.error('AI Assist failed:', error);
      alert('AI支援機能の実行に失敗しました。');
    } finally {
      setAiLoading(false);
    }
  };

  if (!project) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button 
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 mb-2"
          >
            ← ダッシュボードへ
          </button>
          <h2 className="font-bold text-gray-900 truncate">{project.name}</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {PHASES.map((phase) => (
            <button
              key={phase.type}
              onClick={() => setCurrentPhase(phase.type)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                currentPhase === phase.type 
                  ? 'bg-blue-50 text-blue-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm">{phase.label}</div>
              <div className="text-xs opacity-70 truncate">{phase.description}</div>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Toolbar */}
        <div className="h-14 border-b border-gray-200 px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1 text-sm rounded-md ${viewMode === 'edit' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
              >
                編集
              </button>
              <button 
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-sm rounded-md ${viewMode === 'preview' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
              >
                プレビュー
              </button>
            </div>
            <button 
              onClick={() => handleSave()}
              disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <span className={`text-xs ${
              saveStatus === 'saved' ? 'text-green-500' : 
              saveStatus === 'saving' ? 'text-blue-500' : 
              saveStatus === 'error' ? 'text-red-500' : 'text-gray-400'
            }`}>
              {saveStatus === 'saved' && '✓ 保存済み'}
              {saveStatus === 'saving' && '保存中...'}
              {saveStatus === 'error' && '⚠ 保存失敗'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onlineUsers.length > 0 && (
              <div className="flex -space-x-2 mr-4">
                {onlineUsers.map(user => (
                  <div 
                    key={user.id} 
                    title={user.name}
                    className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                  >
                    {user.name.charAt(0)}
                  </div>
                ))}
              </div>
            )}
            <span className="text-xs text-gray-400 mr-2">AI支援:</span>
            <button 
              onClick={() => handleAiAssist('summarize')}
              disabled={aiLoading}
              className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-100 disabled:opacity-50"
            >
              要約・整理
            </button>
            <button 
              onClick={() => handleAiAssist('check_gaps')}
              disabled={aiLoading}
              className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-100 disabled:opacity-50"
            >
              抜け漏れチェック
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showComments 
                  ? 'bg-gray-800 text-white border-gray-800' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              コメント ({comments.filter(c => !c.resolved).length})
            </button>
            <button 
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showHistory 
                  ? 'bg-gray-800 text-white border-gray-800' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              履歴
            </button>
          </div>
        </div>

        {/* Editor/Preview Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : viewMode === 'edit' ? (
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={content}
                onChange={handleContentChange}
                onMount={(editor) => {
                  editorRef.current = editor;
                  editor.onDidChangeCursorPosition(handleCursorChange);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  padding: { top: 20, bottom: 20 }
                }}
              />
            ) : (
              <div className="h-full overflow-y-auto p-12 max-w-4xl mx-auto w-full prose prose-blue">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*内容がありません*'}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Comment Sidebar */}
          {showComments && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                <h3 className="font-bold text-gray-700">コメント</h3>
                <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    コメントはありません
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className={`bg-white p-3 rounded-lg shadow-sm border ${comment.resolved ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-gray-600">{(comment as any).user_name || 'ユーザー'}</span>
                        <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{comment.content}</div>
                      {!comment.resolved && (
                        <button 
                          onClick={() => handleResolveComment(comment.id)}
                          className="text-[10px] text-blue-600 hover:underline font-medium"
                        >
                          解決済みにする
                        </button>
                      )}
                      {comment.resolved && (
                        <span className="text-[10px] text-green-600 font-medium">✓ 解決済み</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-white border-t border-gray-200">
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="コメントを入力..."
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-20"
                />
                <button 
                  onClick={handleAddComment} 
                  disabled={!newComment.trim()}
                  className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  送信
                </button>
              </div>
            </div>
          )}

          {/* History Sidebar */}
          {showHistory && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                <h3 className="font-bold text-gray-700">変更履歴</h3>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    履歴はありません
                  </div>
                ) : (
                  history.map(entry => (
                    <div key={entry.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-600">{entry.action}</span>
                        <span className="text-[10px] text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mb-2">by {entry.user_name || 'ユーザー'}</div>
                      <button 
                        onClick={() => handleRollback(entry.id)}
                        className="text-[10px] text-blue-600 hover:underline font-medium"
                      >
                        この時点に戻す
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
