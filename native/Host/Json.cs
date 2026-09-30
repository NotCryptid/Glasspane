using System.Text.Json.Nodes;

namespace Glasspane.Host;

static class J
{
    public static string? Str(JsonNode? n, string key) =>
        n is JsonObject o && o[key] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

    public static double? Num(JsonNode? n, string key) =>
        n is JsonObject o && o[key] is JsonValue v && v.TryGetValue<double>(out var d) ? d : null;

    public static bool? Bool(JsonNode? n, string key) =>
        n is JsonObject o && o[key] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : null;

    public static bool Has(JsonNode? n, string key) => n is JsonObject o && o[key] != null;
}
