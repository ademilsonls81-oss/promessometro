import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

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
            <Link to="/fontes" className="hover:text-foreground transition-colors">Fontes</Link>
            <Link to="/como-funciona" className="hover:text-foreground transition-colors">Como Funciona</Link>
            <Link to="/quem-somos" className="hover:text-foreground transition-colors">Quem Somos</Link>
            <Link to="/correcoes" className="hover:text-foreground transition-colors">Correções</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos</Link>
          </div>
          
          <p className="text-sm text-muted-foreground">
            © 2026 — A transparência que o Brasil precisa
          </p>
        </div>
      </div>
    </footer>
  );
}