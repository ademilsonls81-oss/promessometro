import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  commands?: Record<string, any>;
  tools?: Record<string, any>;
}

const PLUGINS_DIR = '.aifeast/plugins';

export function getPluginsDir(): string {
  return path.join(os.homedir(), PLUGINS_DIR);
}

export async function loadProjectPlugins(cwd: string): Promise<Record<string, Plugin>> {
  const plugins: Record<string, Plugin> = {};
  
  const packageJson = path.join(cwd, 'package.json');
  if (await fs.pathExists(packageJson)) {
    try {
      const pkg = await fs.readJson(packageJson);
      const aifeastPlugins = pkg.aifeast?.plugins || [];
      
      for (const pluginName of aifeastPlugins) {
        try {
          const pluginPath = path.join(cwd, 'node_modules', pluginName);
          const pluginFile = path.join(pluginPath, 'plugin.js');
          
          if (await fs.pathExists(pluginFile)) {
            const pluginModule = await import(pluginFile);
            plugins[pluginName] = {
              name: pluginName,
              ...pluginModule,
            };
          }
        } catch (error) {
          console.error(`Erro ao carregar plugin ${pluginName}:`, error);
        }
      }
    } catch {}
  }
  
  return plugins;
}

export async function listPlugins(cwd: string): Promise<string[]> {
  const plugins = await loadProjectPlugins(cwd);
  return Object.keys(plugins);
}

export async function invokePlugin(cwd: string, pluginName: string, command: string, args: any): Promise<any> {
  const plugins = await loadProjectPlugins(cwd);
  const plugin = plugins[pluginName];
  
  if (!plugin || !plugin.commands || !plugin.commands[command]) {
    throw new Error(`Comando ${command} não encontrado no plugin ${pluginName}`);
  }
  
  return plugin.commands[command](args);
}