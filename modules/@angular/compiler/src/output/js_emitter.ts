/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import {isBlank, isPresent} from '../facade/lang';

import {EmitterVisitorContext, OutputEmitter} from './abstract_emitter';
import {AbstractJsEmitterVisitor} from './abstract_js_emitter';
import * as o from './output_ast';
import {ImportGenerator} from './path_util';

export class JavaScriptEmitter implements OutputEmitter {
  constructor(private _importGenerator: ImportGenerator) {}
  emitStatements(moduleUrl: string, stmts: o.Statement[], exportedVars: string[]): string {
    const converter = new JsEmitterVisitor(moduleUrl);
    const ctx = EmitterVisitorContext.createRoot(exportedVars);
    converter.visitAllStatements(stmts, ctx);
    const srcParts: string[] = [];
    converter.importsWithPrefixes.forEach((prefix, importedModuleUrl) => {
      // Note: can't write the real word for import as it screws up system.js auto detection...
      srcParts.push(
          `var ${prefix} = req` +
          `uire('${this._importGenerator.getImportPath(moduleUrl, importedModuleUrl)}');`);
    });
    srcParts.push(ctx.toSource());
    return srcParts.join('\n');
  }
}

class JsEmitterVisitor extends AbstractJsEmitterVisitor {
  importsWithPrefixes = new Map<string, string>();

  constructor(private _moduleUrl: string) { super(); }

  visitExternalExpr(ast: o.ExternalExpr, ctx: EmitterVisitorContext): any {
    if (isBlank(ast.value.name)) {
      throw new Error(`Internal error: unknown identifier ${ast.value}`);
    }
    if (isPresent(ast.value.moduleUrl) && ast.value.moduleUrl != this._moduleUrl) {
      let prefix = this.importsWithPrefixes.get(ast.value.moduleUrl);
      if (isBlank(prefix)) {
        prefix = `import${this.importsWithPrefixes.size}`;
        this.importsWithPrefixes.set(ast.value.moduleUrl, prefix);
      }
      ctx.print(`${prefix}.`);
    }
    ctx.print(ast.value.name);
    return null;
  }
  visitDeclareVarStmt(stmt: o.DeclareVarStmt, ctx: EmitterVisitorContext): any {
    super.visitDeclareVarStmt(stmt, ctx);
    if (ctx.isExportedVar(stmt.name)) {
      ctx.println(exportVar(stmt.name));
    }
    return null;
  }
  visitDeclareFunctionStmt(stmt: o.DeclareFunctionStmt, ctx: EmitterVisitorContext): any {
    super.visitDeclareFunctionStmt(stmt, ctx);
    if (ctx.isExportedVar(stmt.name)) {
      ctx.println(exportVar(stmt.name));
    }
    return null;
  }
  visitDeclareClassStmt(stmt: o.ClassStmt, ctx: EmitterVisitorContext): any {
    super.visitDeclareClassStmt(stmt, ctx);
    if (ctx.isExportedVar(stmt.name)) {
      ctx.println(exportVar(stmt.name));
    }
    return null;
  }
}

function exportVar(varName: string): string {
  return `Object.defineProperty(exports, '${varName}', { get: function() { return ${varName}; }});`;
}
