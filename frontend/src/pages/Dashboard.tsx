import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { Project } from '../types';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data.projects);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      // If table doesn't exist, offer to initialize
      if (error.response?.status === 500) {
        if (window.confirm('データベースが初期化されていない可能性があります。初期化しますか？')) {
          handleInitDb();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitDb = async () => {
    try {
      setLoading(true);
      await axios.post(`${process.env.REACT_APP_API_URL}/init-db`);
      alert('データベースを初期化しました。');
      fetchProjects();
    } catch (error) {
      console.error('Failed to init DB:', error);
      alert('初期化に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const project = await api.createProject(newProjectName, newProjectDesc);
      setProjects([project, ...projects]);
      setIsModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h2>
          <p className="text-gray-500">進行中の要件定義・設計プロジェクト</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          + 新規プロジェクト
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-4">プロジェクトがまだありません</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-blue-600 font-medium hover:underline"
          >
            最初のプロジェクトを作成する
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">{project.name}</h3>
              <p className="text-gray-500 text-sm line-clamp-2 mb-4">{project.description || '説明なし'}</p>
              <div className="flex justify-between items-center mt-auto">
                <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded">
                  {project.current_phase === 'idea' ? 'アイデア' : 
                   project.current_phase === 'requirements' ? '要件定義' :
                   project.current_phase === 'design_planning' ? '設計計画' : '設計書'}
                </span>
                <span className="text-xs text-gray-400">
                  更新: {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">新規プロジェクト作成</h3>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">プロジェクト名</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例: 新規ECサイト開発"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
                <textarea 
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24"
                  placeholder="プロジェクトの概要を入力してください"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
