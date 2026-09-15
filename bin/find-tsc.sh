# The TS7 Go compiler, by platform — sourced, never run. Both the CLI's `tsc`
# passthrough and the TypeScript pass of `check` resolve the same binary, and it
# has to be THIS one: `tsc` on PATH is whatever the tree hoisted, and under
# pnpm's hoist fallback that is another package's TypeScript 5.
#
# `find_binary` is the caller's — typescript.sh and commands/check.sh each
# define it against their own roots, and this function is resolved at call time.
find_tsc() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="darwin" ;;
        Linux) os="linux" ;;
        MINGW*|MSYS*|CYGWIN*) os="win32" ;;
        *) os="linux" ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch="arm64" ;;
        armv7l) arch="arm" ;;
        *) arch="x64" ;;
    esac

    local pkg="@typescript/typescript-$os-$arch"
    if [ -x "$PACKAGE_ROOT/node_modules/$pkg/lib/tsc" ]; then
        echo "$PACKAGE_ROOT/node_modules/$pkg/lib/tsc"
    elif [ -x "$PACKAGE_ROOT/../../$pkg/lib/tsc" ]; then
        echo "$PACKAGE_ROOT/../../$pkg/lib/tsc"
    else
        find_binary tsc
    fi
}
