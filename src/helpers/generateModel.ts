import type { DMMF } from "@prisma/generator-helper";
import ts from "typescript";

import { generateField } from "~/helpers/generateField";
import { generateFieldType } from "~/helpers/generateFieldType";
import { generateTypeOverrideFromDocumentation } from "~/helpers/generateTypeOverrideFromDocumentation";
import { normalizeCase } from "~/utils/normalizeCase";
import type { Config } from "~/utils/validateConfig";

/**
 * Some of Prisma's default values are implemented in
 * JS. These should therefore not be annotated as Generated.
 * See https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#attribute-functions.
 */
const defaultTypesImplementedInJS = ["cuid", "uuid"];

export const generateModel = (model: DMMF.Model, config: Config) => {
  const columnNames: string[] = [];
  const properties = model.fields.flatMap((field) => {
    const isGenerated =
      field.hasDefaultValue &&
      !(
        typeof field.default === "object" &&
        "name" in field.default &&
        defaultTypesImplementedInJS.includes(field.default.name)
      );

    const typeOverride = field.documentation
      ? generateTypeOverrideFromDocumentation(field.documentation)
      : null;

    if (field.kind === "object" || field.kind === "unsupported") return [];

    const dbName = typeof field.dbName === "string" ? field.dbName : null;
    const name = normalizeCase(dbName || field.name, config);
    columnNames.push(name);

    if (field.kind === "enum") {
      return generateField({
        isId: field.isId,
        name,
        type: ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier(field.type),
          undefined
        ),
        nullable: !field.isRequired,
        generated: isGenerated,
        list: field.isList,
        documentation: field.documentation,
        config,
      });
    }

    return generateField({
      name,
      type: ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier(
          generateFieldType(field.type, config, typeOverride)
        ),
        undefined
      ),
      nullable: !field.isRequired,
      generated: isGenerated,
      list: field.isList,
      documentation: field.documentation,
      isId: field.isId,
      config,
    });
  });

  return {
    typeName: model.name,
    tableName: model.dbName || model.name,
    definition: ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(model.name),
      undefined,
      ts.factory.createTypeLiteralNode(properties)
    ),
    columnNameArrayDefinition: ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            `columnsOf${model.name}`,
            undefined,
            undefined,
            ts.factory.createAsExpression(
              ts.factory.createArrayLiteralExpression(
                columnNames.map((columnName) => ts.factory.createStringLiteral(columnName)),
                true,
              ),
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier("const"),
                undefined,
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    ),
  };
};
