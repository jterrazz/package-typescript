# `tsc` on PATH is whatever the tree hoisted, under pnpm another package's TypeScript 5.
# `find_binary` is the caller's, resolved at call time.
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
