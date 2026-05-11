import React from "react";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Pricing from "@/components/landing/Pricing";

export default function Landing() {
  // Plataforma pública: sem redirecionamento obrigatório (checklist item 10)
  // Usuário logado enxerga a home normalmente; acesso admin é pelo menu

  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Features />
      <Pricing />
    </div>
  );
}
