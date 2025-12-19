import React from 'react';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Requirements Maker</h1>
        <p>AI共同編集型 要件定義〜設計特化システム</p>
      </header>
      
      <main className="App-main">
        <section className="phases">
          <h2>4つのフェーズ</h2>
          <div className="phase-cards">
            <div className="phase-card">
              <h3>1. アイデアフェーズ</h3>
              <p>自由形式での発想整理とAIによる要約・分類</p>
            </div>
            <div className="phase-card">
              <h3>2. 要件定義フェーズ</h3>
              <p>構造化された要件入力とAIによる曖昧さ・抜け漏れ指摘</p>
            </div>
            <div className="phase-card">
              <h3>3. 設計計画フェーズ</h3>
              <p>技術方針・構成案の整理と要件との整合性チェック</p>
            </div>
            <div className="phase-card">
              <h3>4. 設計書作成フェーズ</h3>
              <p>設計書自動生成と編集、外部出力</p>
            </div>
          </div>
        </section>

        <section className="features">
          <h2>主な機能</h2>
          <ul>
            <li>リアルタイム共同編集（WebSocket）</li>
            <li>AIによる各フェーズ特化支援</li>
            <li>コメント・レビュー機能</li>
            <li>権限管理（オーナー/編集者/閲覧者）</li>
            <li>変更履歴とロールバック</li>
          </ul>
        </section>

        <section className="architecture">
          <h2>技術スタック</h2>
          <div className="tech-stack">
            <div className="tech-category">
              <h4>Frontend</h4>
              <ul>
                <li>React + TypeScript</li>
                <li>WebSocket</li>
                <li>Markdown Editor</li>
              </ul>
            </div>
            <div className="tech-category">
              <h4>Backend</h4>
              <ul>
                <li>Node.js + TypeScript</li>
                <li>AWS Lambda</li>
                <li>API Gateway</li>
                <li>PostgreSQL (RDS)</li>
              </ul>
            </div>
            <div className="tech-category">
              <h4>Infrastructure</h4>
              <ul>
                <li>AWS CloudFormation</li>
                <li>S3 + CloudFront</li>
                <li>CloudWatch</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="getting-started">
          <h2>始め方</h2>
          <ol>
            <li>プロジェクトを作成</li>
            <li>メンバーを招待</li>
            <li>アイデアフェーズから開始</li>
            <li>各フェーズでAIの支援を活用</li>
            <li>設計書を生成・エクスポート</li>
          </ol>
        </section>
      </main>

      <footer className="App-footer">
        <p>&copy; 2024 Requirements Maker. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
