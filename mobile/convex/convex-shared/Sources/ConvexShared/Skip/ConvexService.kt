package convex.shared

import dev.convex.android.ConvexClient
import dev.convex.android.MobileConvexClientInterface
import dev.convex.android.QuerySubscriber
import dev.convex.android.SubscriptionHandle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import skip.foundation.*
import skip.lib.*
import kotlin.reflect.KClass
import kotlin.reflect.full.companionObjectInstance

class ConvexService private constructor() {
    internal var client: ConvexClient? = null
    internal val subscriptionJobs = mutableMapOf<String, Job>()
    internal val scope = CoroutineScope(Dispatchers.Main)
    internal val subscriptionHandles = mutableMapOf<String, SubscriptionHandle>()

    fun initialize(url: String) {
        client = ConvexClient(url)
    }

    internal fun requireClient(): ConvexClient = client ?: throw ConvexError.notInitialized

    internal fun getFfi(): MobileConvexClientInterface {
        val c = requireClient()
        val method = c.javaClass.getMethod("getFfiClient")
        return method.invoke(c) as MobileConvexClientInterface
    }

    internal val jsonApi: Json =
        Json {
            ignoreUnknownKeys = true
            allowSpecialFloatingPointValues = true
        }

    @Suppress("UNCHECKED_CAST")
    internal fun anyToJsonElement(value: Any?): JsonElement {
        if (value == null || value is NSNull) return JsonNull
        return when (value) {
            is Dictionary<*, *> -> {
                val m = value.kotlin() as Map<String, Any?>
                val entries = mutableMapOf<String, JsonElement>()
                for ((k, v) in m) {
                    entries[k] = anyToJsonElement(v)
                }
                JsonObject(entries)
            }

            is Map<*, *> -> {
                val entries = mutableMapOf<String, JsonElement>()
                for ((k, v) in value) {
                    entries[k.toString()] = anyToJsonElement(v)
                }
                JsonObject(entries)
            }

            is skip.lib.Array<*> -> {
                val items = mutableListOf<JsonElement>()
                for (item in value) {
                    items.add(anyToJsonElement(item))
                }
                JsonArray(items)
            }

            is List<*> -> {
                val items = mutableListOf<JsonElement>()
                for (item in value) {
                    items.add(anyToJsonElement(item))
                }
                JsonArray(items)
            }

            is String -> {
                JsonPrimitive(value)
            }

            is Boolean -> {
                JsonPrimitive(value)
            }

            is Int -> {
                JsonPrimitive(value.toDouble())
            }

            is Long -> {
                JsonPrimitive(value.toDouble())
            }

            is Float -> {
                JsonPrimitive(value.toDouble())
            }

            is Double -> {
                JsonPrimitive(value)
            }

            is Number -> {
                JsonPrimitive(value)
            }

            else -> {
                JsonPrimitive(value.toString())
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    internal fun toFfiArgs(args: Any?): Map<String, String> {
        if (args == null) return emptyMap()
        val map =
            when (args) {
                is Dictionary<*, *> -> args.kotlin() as Map<String, Any?>
                is Map<*, *> -> args as Map<String, Any?>
                else -> return emptyMap()
            }
        if (map.isEmpty()) return emptyMap()
        val result = mutableMapOf<String, String>()
        for ((key, value) in map) {
            result[key] = anyToJsonElement(value).toString()
        }
        return result
    }

    internal fun jsonToData(json: JsonElement): Data {
        val str = json.toString()
        return str.data(using = StringEncoding.utf8)!!
    }

    internal val jsonDecoder = JSONDecoder()

    @Suppress("UNCHECKED_CAST")
    internal fun <T : Any> decodeOne(
        data: Data,
        type: KClass<T>,
    ): T {
        val companion =
            type.companionObjectInstance as? DecodableCompanion<T>
                ?: throw RuntimeException("Type ${type.simpleName} does not have DecodableCompanion")
        val decoder = jsonDecoder.decoder(from = data)
        return companion.init(from = decoder)
    }

    @Suppress("UNCHECKED_CAST")
    internal fun <T : Any> decodeArray(
        data: Data,
        type: KClass<T>,
    ): skip.lib.Array<T> {
        val companion =
            type.companionObjectInstance as? DecodableCompanion<T>
                ?: throw RuntimeException("Type ${type.simpleName} does not have DecodableCompanion")
        val decoder = jsonDecoder.decoder(from = data)
        val container = decoder.unkeyedContainer()
        val items = mutableListOf<T>()
        while (!container.isAtEnd) {
            val itemDecoder = container.superDecoder()
            val item = companion.init(from = itemDecoder)
            items.add(item)
        }
        return skip.lib.Array(items, nocopy = true)
    }

    fun cancelSubscription(subId: String) {
        subscriptionJobs[subId]?.cancel()
        subscriptionJobs.remove(subId)
        subscriptionHandles[subId]?.cancel()
        subscriptionHandles.remove(subId)
    }

    suspend fun setAuth(token: String?) {
        val ffi = getFfi()
        ffi.setAuth(token ?: "")
    }

    suspend fun mutate(
        name: String,
        args: Dictionary<String, Any> = dictionaryOf(),
    ) {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        ffi.mutation(name, ffiArgs)
    }

    suspend fun mutation(
        name: String,
        args: Dictionary<String, Any> = dictionaryOf(),
    ) {
        mutate(name, args)
    }

    suspend fun mutateReturningString(
        name: String,
        args: Dictionary<String, Any> = dictionaryOf(),
    ): String {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        val resultJson = ffi.mutation(name, ffiArgs)
        return jsonApi.decodeFromString<String>(resultJson)
    }

    suspend fun action(
        name: String,
        args: Dictionary<String, Any> = dictionaryOf(),
    ) {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        ffi.action(name, ffiArgs)
    }

    internal suspend fun <T : Any> actionArrayImpl(
        name: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
    ): skip.lib.Array<T> {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        val resultJson = ffi.action(name, ffiArgs)
        val json = jsonApi.decodeFromString<JsonArray>(resultJson)
        val data = jsonToData(json)
        return decodeArray(data, type)
    }

    internal suspend fun <T : Any> actionOneImpl(
        name: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
    ): T {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        val resultJson = ffi.action(name, ffiArgs)
        val json = jsonApi.decodeFromString<JsonObject>(resultJson)
        val data = jsonToData(json)
        return decodeOne(data, type)
    }

    internal suspend fun <T : Any> queryNullableImpl(
        name: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
    ): T? {
        val ffi = getFfi()
        val ffiArgs = toFfiArgs(args)
        val resultJson = ffi.action(name, ffiArgs)
        if (resultJson == "null") return null
        val data = resultJson.data(using = StringEncoding.utf8)!!
        return decodeOne(data, type)
    }

    internal fun <T : Any> subscribePaginatedImpl(
        to: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
        onUpdate: (PaginatedResult<T>) -> Unit,
        onError: (Error) -> Unit,
    ): String {
        val name = to
        val ffi: MobileConvexClientInterface
        try {
            ffi = getFfi()
        } catch (e: Throwable) {
            onError(ErrorException(e))
            return ""
        }
        val subId =
            java.util.UUID
                .randomUUID()
                .toString()
        val ffiArgs = toFfiArgs(args)
        val subscriber =
            object : QuerySubscriber {
                override fun onUpdate(result: String) {
                    scope.launch {
                        try {
                            val json = jsonApi.decodeFromString<JsonObject>(result)
                            val pageJson = json["page"] as? JsonArray ?: JsonArray(emptyList())
                            val pageData = jsonToData(pageJson)
                            val page = decodeArray(pageData, type)
                            val continueCursor = json["continueCursor"]?.toString()?.trim('"') ?: ""
                            val isDone = json["isDone"]?.toString() == "true"
                            onUpdate(PaginatedResult(page = page, continueCursor = continueCursor, isDone = isDone))
                        } catch (e: Throwable) {
                            onError(ErrorException(e))
                        }
                    }
                }

                override fun onError(
                    message: String,
                    value: String?,
                ) {
                    scope.launch { onError(ErrorException(Exception("$message: $value"))) }
                }
            }
        val job =
            scope.launch {
                val handle = ffi.subscribe(name, ffiArgs, subscriber)
                subscriptionHandles[subId] = handle
            }
        subscriptionJobs[subId] = job
        return subId
    }

    internal fun <T : Any> subscribeArrayImpl(
        to: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
        onUpdate: (skip.lib.Array<T>) -> Unit,
        onError: (Error) -> Unit,
    ): String {
        val name = to
        val ffi: MobileConvexClientInterface
        try {
            ffi = getFfi()
        } catch (e: Throwable) {
            onError(ErrorException(e))
            return ""
        }
        val subId =
            java.util.UUID
                .randomUUID()
                .toString()
        val ffiArgs = toFfiArgs(args)
        val subscriber =
            object : QuerySubscriber {
                override fun onUpdate(result: String) {
                    scope.launch {
                        try {
                            val json = jsonApi.decodeFromString<JsonArray>(result)
                            val data = jsonToData(json)
                            val decoded = decodeArray(data, type)
                            onUpdate(decoded)
                        } catch (e: Throwable) {
                            onError(ErrorException(e))
                        }
                    }
                }

                override fun onError(
                    message: String,
                    value: String?,
                ) {
                    scope.launch { onError(ErrorException(Exception("$message: $value"))) }
                }
            }
        val job =
            scope.launch {
                val handle = ffi.subscribe(name, ffiArgs, subscriber)
                subscriptionHandles[subId] = handle
            }
        subscriptionJobs[subId] = job
        return subId
    }

    internal fun <T : Any> subscribeSingleImpl(
        to: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
        onUpdate: (T) -> Unit,
        onError: (Error) -> Unit,
    ): String {
        val name = to
        val ffi: MobileConvexClientInterface
        try {
            ffi = getFfi()
        } catch (e: Throwable) {
            onError(ErrorException(e))
            return ""
        }
        val subId =
            java.util.UUID
                .randomUUID()
                .toString()
        val ffiArgs = toFfiArgs(args)
        val subscriber =
            object : QuerySubscriber {
                override fun onUpdate(result: String) {
                    scope.launch {
                        try {
                            val json = jsonApi.decodeFromString<JsonElement>(result)
                            val data = jsonToData(json)
                            val decoded = decodeOne(data, type)
                            onUpdate(decoded)
                        } catch (e: Throwable) {
                            onError(ErrorException(e))
                        }
                    }
                }

                override fun onError(
                    message: String,
                    value: String?,
                ) {
                    scope.launch { onError(ErrorException(Exception("$message: $value"))) }
                }
            }
        val job =
            scope.launch {
                val handle = ffi.subscribe(name, ffiArgs, subscriber)
                subscriptionHandles[subId] = handle
            }
        subscriptionJobs[subId] = job
        return subId
    }

    internal fun <T : Any> subscribeNullableImpl(
        to: String,
        args: Dictionary<String, Any>,
        type: KClass<T>,
        onUpdate: (T) -> Unit,
        onError: (Error) -> Unit,
        onNull: () -> Unit,
    ): String {
        val name = to
        val ffi: MobileConvexClientInterface
        try {
            ffi = getFfi()
        } catch (e: Throwable) {
            onError(ErrorException(e))
            return ""
        }
        val subId =
            java.util.UUID
                .randomUUID()
                .toString()
        val ffiArgs = toFfiArgs(args)
        val subscriber =
            object : QuerySubscriber {
                override fun onUpdate(result: String) {
                    scope.launch {
                        try {
                            if (result != "null") {
                                val data = result.data(using = StringEncoding.utf8)!!
                                val decoded = decodeOne(data, type)
                                onUpdate(decoded)
                            } else {
                                onNull()
                            }
                        } catch (e: Throwable) {
                            onError(ErrorException(e))
                        }
                    }
                }

                override fun onError(
                    message: String,
                    value: String?,
                ) {
                    scope.launch { onError(ErrorException(Exception("$message: $value"))) }
                }
            }
        val job =
            scope.launch {
                val handle = ffi.subscribe(name, ffiArgs, subscriber)
                subscriptionHandles[subId] = handle
            }
        subscriptionJobs[subId] = job
        return subId
    }

    companion object {
        val shared = ConvexService()
    }
}
