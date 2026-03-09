import SwiftUI

extension View {
    @ViewBuilder
    public func roundedBorderTextField() -> some View {
        #if !SKIP
        textFieldStyle(.roundedBorder)
        #else
        self
        #endif
    }

    @ViewBuilder
    public func noAutocorrection() -> some View {
        #if !SKIP
        autocorrectionDisabled()
        #else
        self
        #endif
    }

    @ViewBuilder
    public func primaryForeground() -> some View {
        #if !SKIP
        foregroundStyle(.primary)
        #else
        self
        #endif
    }
}
