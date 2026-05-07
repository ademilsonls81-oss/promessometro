import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface Skill {
  name: string;
  description: string;
  prompt: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

const SKILL_DIR = '.aifeast/skills';

export function getSkillsDir(): string {
  return path.join(os.homedir(), SKILL_DIR);
}

export async function loadSkills(cwd: string): Promise<Record<string, Skill>> {
  const skills: Record<string, Skill> = {};
  
  const projectSkillsDir = path.join(cwd, '.agent/skills');
  const globalSkillsDir = getSkillsDir();
  const dirs = [projectSkillsDir, globalSkillsDir];
  
  for (const dir of dirs) {
    if (!await fs.pathExists(dir)) continue;
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillDir = path.join(dir, entry.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      
      if (!await fs.pathExists(skillFile)) continue;
      
      try {
        const content = await fs.readFile(skillFile, 'utf-8');
        const skill = parseSkillFile(content, entry.name);
        skills[entry.name] = skill;
      } catch (error) {
        console.error(`Erro ao carregar skill ${entry.name}:`, error);
      }
    }
  }
  
  return skills;
}

function parseSkillFile(content: string, name: string): Skill {
  const skill: Skill = {
    name,
    description: '',
    prompt: content,
  };
  
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const frontmatter = match[1];
    
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) skill.name = nameMatch[1].trim();
    
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) skill.description = descMatch[1].trim();
    
    const licenseMatch = frontmatter.match(/^license:\s*(.+)$/m);
    if (licenseMatch) skill.license = licenseMatch[1].trim();
    
    const compatMatch = frontmatter.match(/^compatibility:\s*(.+)$/m);
    if (compatMatch) skill.compatibility = compatMatch[1].trim();
  }
  
  const afterFrontmatter = content.replace(/^---[\s\S]*?\n---/, '').trim();
  if (afterFrontmatter) {
    skill.prompt = afterFrontmatter;
  }
  
  return skill;
}

export async function listSkills(cwd: string): Promise<string[]> {
  const skills = await loadSkills(cwd);
  return Object.keys(skills);
}

export async function getSkill(cwd: string, name: string): Promise<Skill | null> {
  const skills = await loadSkills(cwd);
  return skills[name] || null;
}

export function buildSkillPrompt(skills: Record<string, Skill>): string {
  const skillList = Object.entries(skills).map(([name, skill]) => 
    `- ${name}: ${skill.description}`
  ).join('\n');
  
  return `SKILLS DISPONIVEIS:\n${skillList || 'Nenhuma skill carregada'}`;
}