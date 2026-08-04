from typing import Any


# Converts snake_case keys in a dict to camelCase for the frontend.
# Handles dicts, lists, and primitives recursively.
# Retains raw user-defined custom metadata formats (customFields, options) without recursion.
def to_camel_case(data: Any) -> Any:
    if isinstance(data, list):
        return [to_camel_case(item) for item in data]
    elif isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            parts = key.split('_')
            camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
            if camel_key in ['customFields', 'options']:
                new_dict[camel_key] = value
            else:
                new_dict[camel_key] = to_camel_case(value)
        return new_dict
    else:
        return data
