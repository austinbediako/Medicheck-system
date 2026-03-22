% =============================================================================
% MediCheck Bridge — Prolog ↔ Node.js Entry Point
% =============================================================================
%
% Usage (called by Node.js via child_process.spawn):
%
%   swipl -g "main" -t halt bridge.pl -- \
%       --symptoms "fever,chills,headache" \
%       --duration "more_than_2_weeks"
%
% The bridge reads CLI arguments, calls the inference engine, and prints
% a single JSON object to stdout. Node parses this output.
%
% Output JSON schema:
% {
%   "diagnosis":        string,
%   "confidence":       "high" | "medium" | "possible" | "none",
%   "rules_fired":      string[],
%   "matched_symptoms": string[],
%   "reasoning":        string,
%   "advice":           string,
%   "error":            string | null
% }
% =============================================================================

:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(json)).

:- [knowledge_base].
:- [inference_engine].

% ---------------------------------------------------------------------------
% main/0 — Entry point called by -g "main"
% ---------------------------------------------------------------------------
main :-
    catch(
        run_bridge,
        Error,
        (
            term_string(Error, ErrStr),
            output_error_json(ErrStr)
        )
    ).

run_bridge :-
    % Parse CLI arguments after '--'
    current_prolog_flag(argv, AllArgs),
    (   append(_, ['--'|BridgeArgs], AllArgs)
    ->  true
    ;   BridgeArgs = AllArgs
    ),

    % Extract --symptoms and --duration flags
    extract_arg('--symptoms',  BridgeArgs, SymptomsStr),
    extract_arg_optional('--duration', BridgeArgs, DurationStr, 'unknown'),

    % Parse comma-separated symptoms into atom list
    split_string(SymptomsStr, ",", " ", SymptomStrings),
    maplist([S, A]>>(atom_string(A, S)), SymptomStrings, Symptoms),
    atom_string(Duration, DurationStr),

    % Run inference engine (forward chaining)
    diagnose(Symptoms, Duration, Result),

    % Emit result as JSON
    output_result_json(Result).


% ---------------------------------------------------------------------------
% extract_arg(+Flag, +Args, -Value)
% Finds --flag value in the argument list. Fails with clear error if missing.
% ---------------------------------------------------------------------------
extract_arg(Flag, Args, Value) :-
    (   append(_, [Flag, Value | _], Args)
    ->  true
    ;   format(atom(Msg), "Missing required argument: ~w", [Flag]),
        throw(error(Msg))
    ).

extract_arg_optional(Flag, Args, Value, Default) :-
    (   append(_, [Flag, Value | _], Args)
    ->  true
    ;   Value = Default
    ).


% ---------------------------------------------------------------------------
% output_result_json(+Result)
%
% Prints the diagnosis result as a JSON object to stdout.
% Node.js reads this from the process stdout.
% ---------------------------------------------------------------------------
output_result_json(Result) :-
    get_dict(diagnosis,        Result, Diagnosis),
    get_dict(confidence,       Result, Confidence),
    get_dict(rules_fired,      Result, RulesFired),
    get_dict(matched_symptoms, Result, MatchedSymptoms),
    get_dict(reasoning,        Result, Reasoning),
    get_dict(advice,           Result, Advice),

    % Build JSON term
    maplist([S, json_string(S)]>>true, RulesFired, RulesFiredJson),
    maplist([S, json_string(S)]>>true, MatchedSymptoms, MatchedSymptomsJson),

    JSONTerm = json([
        diagnosis        = Diagnosis,
        confidence       = Confidence,
        rules_fired      = RulesFired,
        matched_symptoms = MatchedSymptoms,
        reasoning        = Reasoning,
        advice           = Advice,
        error            = @(null)
    ]),

    % Write JSON to stdout
    with_output_to(string(JSONStr), json_write(current_output, JSONTerm, [width(0)])),
    writeln(JSONStr).


output_error_json(ErrStr) :-
    JSONTerm = json([
        diagnosis        = 'Error',
        confidence       = 'none',
        rules_fired      = [],
        matched_symptoms = [],
        reasoning        = '',
        advice           = '',
        error            = ErrStr
    ]),
    with_output_to(string(JSONStr), json_write(current_output, JSONTerm, [width(0)])),
    writeln(JSONStr).


% ---------------------------------------------------------------------------
% Expose symptom list for GET /api/symptoms (called separately)
% ---------------------------------------------------------------------------
list_symptoms :-
    findall(
        json([name=NameStr, display=DisplayStr, category=CategoryStr]),
        (
            disease(Disease),
            symptom(Disease, Sym),
            (symptom_display(Sym, Display) -> true ; Display = Sym),
            atom_string(Sym, NameStr),
            atom_string(Display, DisplayStr),
            atom_string(Disease, CategoryStr)
        ),
        SymptomList
    ),
    list_to_set(SymptomList, UniqueList),
    JSONTerm = json([symptoms = UniqueList]),
    with_output_to(string(JSONStr), json_write(current_output, JSONTerm, [width(0)])),
    writeln(JSONStr).
