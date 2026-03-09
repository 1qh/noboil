import Foundation

@preconcurrency
@MainActor
public protocol Performing: AnyObject {
    var errorMessage: String? { get set }
}

extension Performing {
    public func perform(_ action: () async throws -> Void) async {
        do {
            try await action()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func performLoading(
        _ setLoading: (Bool) -> Void,
        _ action: () async throws -> Void
    ) async {
        setLoading(true)
        errorMessage = nil
        defer { setLoading(false) }
        do {
            try await action()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
