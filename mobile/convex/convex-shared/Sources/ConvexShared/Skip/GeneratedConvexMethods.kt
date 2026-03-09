@file:Suppress("unused")

package convex.shared

import skip.foundation.*
import skip.lib.*

fun ConvexService.subscribePaginatedBlogs(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (PaginatedResult<Blog>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribePaginatedImpl(to, args, Blog::class, onUpdate, onError)

fun ConvexService.subscribePaginatedChats(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (PaginatedResult<Chat>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribePaginatedImpl(to, args, Chat::class, onUpdate, onError)

fun ConvexService.subscribePaginatedProjects(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (PaginatedResult<Project>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribePaginatedImpl(to, args, Project::class, onUpdate, onError)

fun ConvexService.subscribePaginatedWikis(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (PaginatedResult<Wiki>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribePaginatedImpl(to, args, Wiki::class, onUpdate, onError)

fun ConvexService.subscribeOrgsWithRole(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<OrgWithRole>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, OrgWithRole::class, onUpdate, onError)

fun ConvexService.subscribeOrgMembers(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<OrgMemberEntry>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, OrgMemberEntry::class, onUpdate, onError)

fun ConvexService.subscribeTasks(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<TaskItem>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, TaskItem::class, onUpdate, onError)

fun ConvexService.subscribeInvites(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<OrgInvite>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, OrgInvite::class, onUpdate, onError)

fun ConvexService.subscribeJoinRequests(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<JoinRequestEntry>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, JoinRequestEntry::class, onUpdate, onError)

fun ConvexService.subscribeEditors(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<EditorEntry>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, EditorEntry::class, onUpdate, onError)

fun ConvexService.subscribeMessages(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<Message>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, Message::class, onUpdate, onError)

fun ConvexService.subscribeBlog(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Blog) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Blog::class, onUpdate, onError)

fun ConvexService.subscribeMovie(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Movie) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Movie::class, onUpdate, onError)

fun ConvexService.subscribeWiki(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Wiki) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Wiki::class, onUpdate, onError)

fun ConvexService.subscribeChat(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Chat) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Chat::class, onUpdate, onError)

fun ConvexService.subscribeProfileData(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (ProfileData) -> Unit,
    onError: (Error) -> Unit = { },
    onNull: () -> Unit = { },
): String = subscribeNullableImpl(to, args, ProfileData::class, onUpdate, onError, onNull)

suspend fun ConvexService.actionSearchResults(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<SearchResult> = actionArrayImpl(name, args, SearchResult::class)

suspend fun ConvexService.actionMovie(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): Movie = actionOneImpl(name, args, Movie::class)

suspend fun ConvexService.queryProfileData(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): ProfileData? = queryNullableImpl(name, args, ProfileData::class)

fun ConvexService.subscribeBlogProfile(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (BlogProfile) -> Unit,
    onError: (Error) -> Unit = { },
    onNull: () -> Unit = { },
): String = subscribeNullableImpl(to, args, BlogProfile::class, onUpdate, onError, onNull)

fun ConvexService.subscribeOrgProfile(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (OrgProfile) -> Unit,
    onError: (Error) -> Unit = { },
    onNull: () -> Unit = { },
): String = subscribeNullableImpl(to, args, OrgProfile::class, onUpdate, onError, onNull)

fun ConvexService.subscribeProject(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Project) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Project::class, onUpdate, onError)

fun ConvexService.subscribeOrg(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Org) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Org::class, onUpdate, onError)

fun ConvexService.subscribeNullableOrg(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Org) -> Unit,
    onError: (Error) -> Unit = { },
    onNull: () -> Unit = { },
): String = subscribeNullableImpl(to, args, Org::class, onUpdate, onError, onNull)

fun ConvexService.subscribeSlugAvailability(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (SlugAvailability) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, SlugAvailability::class, onUpdate, onError)

fun ConvexService.subscribeOrgMembership(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (OrgMembership) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, OrgMembership::class, onUpdate, onError)

fun ConvexService.subscribeNullableOrgJoinRequest(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (OrgJoinRequest) -> Unit,
    onError: (Error) -> Unit = { },
    onNull: () -> Unit = { },
): String = subscribeNullableImpl(to, args, OrgJoinRequest::class, onUpdate, onError, onNull)

fun ConvexService.subscribePaginatedTaskItems(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (PaginatedResult<TaskItem>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribePaginatedImpl(to, args, TaskItem::class, onUpdate, onError)

fun ConvexService.subscribeTaskItem(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (TaskItem) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, TaskItem::class, onUpdate, onError)

fun ConvexService.subscribeTaskItems(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (skip.lib.Array<TaskItem>) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeArrayImpl(to, args, TaskItem::class, onUpdate, onError)

fun ConvexService.subscribeMessage(
    to: String,
    args: Dictionary<String, Any> = dictionaryOf(),
    onUpdate: (Message) -> Unit,
    onError: (Error) -> Unit = { },
): String = subscribeSingleImpl(to, args, Message::class, onUpdate, onError)

suspend fun ConvexService.actionMovies(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<Movie> = actionArrayImpl(name, args, Movie::class)

suspend fun ConvexService.queryOrg(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): Org = actionOneImpl(name, args, Org::class)

suspend fun ConvexService.queryNullableOrg(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): Org? = queryNullableImpl(name, args, Org::class)

suspend fun ConvexService.queryOrgMembership(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): OrgMembership = actionOneImpl(name, args, OrgMembership::class)

suspend fun ConvexService.queryNullableOrgJoinRequest(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): OrgJoinRequest? = queryNullableImpl(name, args, OrgJoinRequest::class)

suspend fun ConvexService.queryOrgMemberEntrys(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<OrgMemberEntry> = actionArrayImpl(name, args, OrgMemberEntry::class)

suspend fun ConvexService.queryOrgWithRoles(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<OrgWithRole> = actionArrayImpl(name, args, OrgWithRole::class)

suspend fun ConvexService.queryOrgInvites(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<OrgInvite> = actionArrayImpl(name, args, OrgInvite::class)

suspend fun ConvexService.queryJoinRequestEntrys(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<JoinRequestEntry> = actionArrayImpl(name, args, JoinRequestEntry::class)

suspend fun ConvexService.querySlugAvailability(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): SlugAvailability = actionOneImpl(name, args, SlugAvailability::class)

suspend fun ConvexService.queryChat(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): Chat = actionOneImpl(name, args, Chat::class)

suspend fun ConvexService.queryMessages(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<Message> = actionArrayImpl(name, args, Message::class)

suspend fun ConvexService.queryMessage(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): Message = actionOneImpl(name, args, Message::class)

suspend fun ConvexService.queryTaskItems(
    name: String,
    args: Dictionary<String, Any> = dictionaryOf(),
): skip.lib.Array<TaskItem> = actionArrayImpl(name, args, TaskItem::class)
