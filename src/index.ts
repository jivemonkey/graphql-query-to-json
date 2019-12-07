import {parse} from "graphql"
import {EnumType} from "json-to-graphql-query"

type variablesObject = {
    [variableName: string]: string
}

interface Argument {
    kind: string
    name: {
        kind: string
        value: string
    }
    value: {
        kind: string
        value: string
        block: boolean
        fields?: Argument[]
    }
}

interface Selection {
    kind: string
    alias: {
        kind: string
        value: string
    }
    name: {
        kind: string
        value: string
    }
    arguments?: Argument[]
    selectionSet?: SelectionSet
}

interface SelectionSet {
    kind: string
    selections: Selection[]
}

interface VariableDefinition {
    kind: string
    variable: {
        kind: string
        name: {
            kind: string
            value: string
        }
    }
    type: {
        kind: string
        name: {
            kind: string
            value: string
        }
    }
}

interface ActualDefinitionNode {
    operation: string
    selectionSet: SelectionSet
    variableDefinitions?: VariableDefinition[]
}

const getArgumentObject = (argumentFields: Argument[]) => {
    const argObj = {}
    argumentFields.forEach((arg) => {
        if (arg.value.kind === "ObjectValue") {
            argObj[arg.name.value] = getArgumentObject(arg.value.fields)
        } else {
            argObj[arg.name.value] = arg.value.value
        }
    })
    return argObj
}

const getArguments = (args) => {
    const argsObj = {}
    args.forEach((arg) => {
        console.warn({arg})
        if (arg.value.kind === "ObjectValue") {
            argsObj[arg.name.value] = getArgumentObject(arg.value.fields)
        } else if (arg.selectionSet) {
            argsObj[arg.name.value] = getSelections(arg.selectionSet.selections)
        } else if (arg.value.kind === "EnumValue") {
            argsObj[arg.name.value] = new EnumType(arg.value.value)
        } else {
            argsObj[arg.name.value] = arg.value.value
        }
    })
    console.warn({argsObj})
    return argsObj
}

const getSelections = (selections: Selection[]) => {
    const selObj = {}
    selections.forEach((selection) => {
        if (selection.alias) {
            selObj[selection.name.value] = {
                __aliasFor: selection.alias.value,
                ...getSelections(selection.selectionSet.selections),
            }
        }
        if (selection.selectionSet) {
            // console.warn({gettingSelection: JSON.stringify(selection.selectionSet, undefined, 4)})
            selObj[selection.name.value] = getSelections(
                selection.selectionSet.selections
            )
        }
        if (selection.arguments.length > 0) {
            selObj[selection.name.value].__args = getArguments(
                selection.arguments
            )
        }
        if (!selection.selectionSet && !selection.arguments.length) {
            selObj[selection.name.value] = true
        }
    })
    return selObj
}

interface Variable {
    key: string
    type: string
    value: any
}

const getVariables = (defintion: ActualDefinitionNode): Variable[] => {
    if (!defintion.variableDefinitions.length) {
        return []
    } else {
        return defintion.variableDefinitions.reduce((prev, curr) => {
            return [
                ...prev,
                {
                    key: curr.variable.name.value,
                    type: curr.type.name.value,
                    value: "Dummy_Value",
                },
            ]
        }, [])
    }
}

export const graphQlQueryToJson = (
    query: string,
    options: {
        variables?: variablesObject
    } = {}
) => {
    const jsonObject = {}
    const parsedQuery = parse(query)
    // console.log(JSON.stringify(parsedQuery, undefined, 4))
    if (parsedQuery.definitions.length > 1) {
        throw new Error(`The parsed query has more than one set of definitions`)
    }
    // @ts-ignore
    const firstDefinition = parsedQuery.definitions[0] as ActualDefinitionNode
    const operation = firstDefinition.operation

    // const variablesUsedInQuery = getVariables(firstDefinition)
    const selections = getSelections(firstDefinition.selectionSet.selections)

    jsonObject[operation] = selections
    // console.log(JSON.stringify(jsonObject, undefined, 4))
    return jsonObject
}
