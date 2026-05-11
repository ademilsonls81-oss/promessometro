import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Github, Code } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">Promessômetro</span>
          </Link>
          
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/metodologia" className="hover:text-foreground transition-colors">Metodologia</Link>
            <Link to="/transparencia" className="hover:text-foreground transition-colors">Transparência</Link>
            <Link to="/auditoria" className="hover:text-foreground transition-colors">Auditoria</Link>
            <Link to="/fontes" className="hover:text-foreground transition-colors">Fontes</Link>
            <a href="/api/v1/docs" className="hover:text-foreground transition-colors flex items-center gap-1">API <Code className="w-3 h-3" /></a>
            <a href="https://github.com/ademilsonls81-oss/promessometro" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">GitHub <Github className="w-3 h-3" /></a>
          </div>
          
          <p className="text-sm text-muted-foreground">
            © 2026 — Dados abertos sob licença MIT
          </p>
        </div>
      </div>
    </footer>
  );
}